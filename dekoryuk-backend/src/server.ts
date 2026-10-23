import express from 'express';
import type { Application, Request, Response, NextFunction } from 'express';
import dotenv = require('dotenv');
import { PrismaClient } from '@prisma/client';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import cors from 'cors';
const midtransClient = require('midtrans-client');

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;

const prisma = new PrismaClient();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// =================================================================
// KUNCI JAWABAN: Satu Kunci Rahasia Universal untuk Semua Token JWT
// =================================================================
const SECRET_KEY = process.env.JWT_SECRET || 'rahasia_negara_dekoryuk_2026';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    }
});

// Middleware dasar
app.use(cors({
    origin: ['http://localhost:3000', process.env.CLIENT_URL as string],
    credentials: true
}));

// Perbesar batas ukuran agar gambar kanvas bisa masuk
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Rute Tes
app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Selamat datang di API Backend DekorYuk!' });
});

// Autentikasi Google
app.post('/auth/google', async (req: Request, res: Response): Promise<any> => {
    try {
        const { idToken } = req.body;
        if (!idToken) return res.status(400).json({ message: 'ID Token wajib disertakan'});

        const ticket = await googleClient.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
        const payload = ticket.getPayload();
        if (!payload || !payload.email) return res.status(400).json ({ message: 'Token tidak ditemukan' });

        const { sub: googleId, email, name } = payload;
        let user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            user = await prisma.user.create({ data: { email, name: name || 'Pengguna', googleId } });  
        } else if (!user.googleId) {
            user = await prisma.user.update({ where: { id: user.id }, data: { googleId } });
        }

        const sessionToken = jwt.sign({ userId: user.id, email: user.email }, SECRET_KEY, { expiresIn: '7d' });
        return res.status(200).json({ message: 'Login Google berhasil.', token: sessionToken, user });
    } catch (error) {
        console.error("Error Google Login:", error);
        return res.status(500).json({ message: 'Gagal memproses autentikasi Google.' });
    }
});

// Kirim Magic Link
app.post('/auth/magic-link', async (req: Request, res: Response): Promise<any> => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: 'Email wajib diisi.' });

        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) user = await prisma.user.create({ data: { email } });

        const magicToken = jwt.sign({ userId: user.id, email: user.email, purpose: 'magic-link' }, SECRET_KEY, { expiresIn: '15m'});
        const magicUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/verify?token=${magicToken}`;

        await transporter.sendMail ({
            from: `"DekorYuk" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Tautan Masuk Akun DekorYuk Anda',
            html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: auto; padding: 24px; border: 1px solid #eaeaea; border-radius: 8px;">
                <h2 style="color: #333; text-align: center;">Masuk ke DekorYuk</h2>
                <p>Klik tombol di bawah ini untuk masuk secara instan. Tautan ini berlaku 15 menit.</p>
                <div style="text-align: center; margin: 32px 0;">
                    <a href="${magicUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Masuk Sekarang</a>
                </div>
            </div>
            `,
        });
        
        return res.status(200).json({ message: 'tautan berhasil dikirim!' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Gagal mengirimkan tautan!'});
    }
});

// Verifikasi Magic Link
app.post('/auth/verify-magic-link', async (req: Request, res: Response): Promise<any> => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ message: 'Token wajib disertakan.' });

        const decoded = jwt.verify(token, SECRET_KEY) as any;
        if (decoded.purpose !== 'magic-link') return res.status(400).json({ message: "Token tidak sah!" });

        const user = await prisma.user.findUnique({ where: { id:decoded.userId} });
        if (!user) return res.status(404).json({ message: ' Pengguna tidak ditemukan.' });

        const sessionToken = jwt.sign({ userId: user.id, email: user.email }, SECRET_KEY, { expiresIn: '7d' });
        return res.status(200).json({ message: 'Verifikasi berhasil', token: sessionToken,user });
    } catch (error) {
        return res.status(401).json ({ message: 'Tautan kadaluwarsa atau tidak valid.' })
    }
});

// ==========================================
// MIDDLEWARE: PEMERIKSA TOKEN JWT
// ==========================================
const authenticateToken = (req: Request, res: Response, next: NextFunction): any => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ message: 'Akses ditolak. Anda belum login.' });
    }

    // HARDCODE MUTLAK: Memaksa Node.js membaca teks ini secara langsung
    const KUNCI_PASTI = 'rahasia_negara_dekoryuk_2026';

    jwt.verify(token, KUNCI_PASTI, (err, decoded) => {
        if (err) {
            console.error("Gagal Verifikasi Token:", err.message);
            return res.status(403).json({ message: 'Token tidak valid atau kedaluwarsa.' });
        }
        
        (req as any).user = decoded; 
        next(); 
    });
};

// ==========================================
// ENDPOINT: SIMPAN PROYEK KE DATABASE
// ==========================================
app.post('/api/projects', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const { image, name, colorHex } = req.body;
        const userId = (req as any).user.userId; 
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return res.status(400).json({ message: 'User tidak ditemukan.'});
        }

        const userLimits = user as typeof user & { plan?: string; saveCount?: number };
        if (userLimits.plan === 'pemula' && (userLimits.saveCount ?? 0) >= 3) {
            return res.status(403).json({
                message: 'Batas simpan gratis (3x) untuk akun pemula sudah habis! Silakan Upgrade!'
            });
        }

        if (userLimits.plan === 'pelajar' && (userLimits.saveCount ?? 0) >= 10) {
            return res.status(403).json({
                message: 'Batas simpan (10x untuk akun pelajar sudah habis! Silakan upgrade ke Pro!'
            })
        }

        if (!image) {
            return res.status(400).json({ message: 'Data gambar kosong.' });
        }
        

        const newProject = await prisma.project.create({
            data: {
                title: name || 'Proyek Dekorasi Tanpa Nama',
                imageUrl: image,
                colorHex: colorHex || '#ffffff',
                userId: userId
            }
        });

        await prisma.user.update({
            where: { id: userId },
            data: { saveCount: (userLimits.saveCount ?? 0) + 1 } as any
        });

        return res.status(201).json({ 
            message: 'Proyek berhasil disimpan ke profil!', 
            project: newProject,
            remainingSaves: userLimits.plan === 'pemula' ? 3 - ((userLimits.saveCount ?? 0) + 1) : null
        });

    } catch (error) {
        console.error("Gagal menyimpan proyek:", error);
        return res.status(500).json({ message: 'Terjadi kesalahan pada server saat menyimpan.' });
    }
});

app.get('/api/projects', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = (req as any).user.userId;

        // Mencari semua proyek milik user yang sedang login
        const userProjects = await prisma.project.findMany({
            where: { userId: userId },
            orderBy: { id: 'desc' } // Mengurutkan dari yang terbaru
        });

        return res.status(200).json(userProjects);
    } catch (error) {
        console.error("Gagal mengambil proyek:", error);
        return res.status(500).json({ message: 'Terjadi kesalahan saat mengambil data.' });
    }
});

const snap = new midtransClient.Snap({
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
    serverKey: process.env.MIDTRANS_SERVER_KEY || ''
});

app.post('/api/payment/subscribe', authenticateToken, async (req:Request, res: Response): Promise<any>=> {

    try {
        const { plan } =req.body;
        const userId = (req as any).user.userId;

        let grossAmount = 0;
        if (plan === 'pelajar') grossAmount = 15000;
        else if (plan === 'pro') grossAmount = 50000;
        else return res.status(400).json({ message: 'Paket tidak valid'});

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ message: 'User tidak ditemukan' });

        const shortUserId = user.id.substring(0, 8);
        const orderId = `DEKOR-${shortUserId}-${Date.now()}`;

        const parameter = {
            transaction_details: {
                order_id: orderId,
                gross_amount:grossAmount
            },
            customer_details: {
                first_name: user.name || 'Pengguna',
                email: user.email
            },
            item_details: [{
                id: plan,
                price: grossAmount,
                quantity: 1,
                name: `Langganan DekorYuk - Paket ${plan.toUpperCase()}`
            }]
        };

        const transaction = await snap.createTransaction(parameter);

        return res.status(200).json({
            token: transaction.token,
            redirect_url: transaction.redirect_url
        });

    } catch (error: any) {
        console.error("Gagal membuat transaksi", error.message);
        return res.status(500).json({ message: 'Terjadi kesalahan pada serverpembayaran!'})
    }
});

app.post('/api/payment/notification', async (req: Request, res: Response): Promise<any> => {
    try {
        const notification = req.body;
        
        // Verifikasi status dari Midtrans
        const transactionStatus = notification.transaction_status;
        const fraudStatus = notification.fraud_status;
        const orderId = notification.order_id; // Format: DEKOR-UserId-Timestamp

        // Ambil ID pengguna dari string orderId
        const parts = orderId.split('-');
        const userId = parts[1]; // Mengambil bagian ID user

        if (!userId) {
            return res.status(400).json({ message: 'Order ID tidak valid' });
        }

        // Tentukan paket berdasarkan nominal atau item
        // Kita bisa cek dari gross_amount atau order ID, misal kita tentukan dari amount:
        const grossAmount = parseInt(notification.gross_amount);
        let newPlan = 'pemula';
        if (grossAmount === 15000) newPlan = 'pelajar';
        else if (grossAmount === 50000) newPlan = 'pro';

        // Jika transaksi sukses/settlement
        if (transactionStatus == 'capture' || transactionStatus == 'settlement') {
            if (fraudStatus == 'accept' || !fraudStatus) {
                // Update role/plan user di Database PostgreSQL menggunakan Prisma
                await prisma.user.update({
                    where: { id: userId },
                    data: { plan: newPlan }
                });
                console.log(`[MIDTRANS] Sukses! User ${userId} berhasil di-upgrade ke paket: ${newPlan}`);
            }
        } 
        else if (transactionStatus == 'cancel' || transactionStatus == 'deny' || transactionStatus == 'expire') {
            console.log(`[MIDTRANS] Transaksi gagal/dibatalkan untuk order: ${orderId}`);
        }

        return res.status(200).json({ status: 'OK' });
    } catch (error: any) {
        console.error("Gagal memproses notifikasi:", error.message);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Menjalankan Server
app.listen(PORT, () => {
    console.log(`Server Express berjalan di http://localhost:${PORT}`);
});