import express from 'express';
import type { Application, Request, Response } from 'express';
import dotenv = require('dotenv');
import { PrismaClient } from '@prisma/client';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';

const cors: () => import('express').RequestHandler = require('cors');

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;

const prisma = new PrismaClient();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    }
});


// Middleware dasar
app.use(cors());
app.use(express.json());

// Rute Tes Sederhana
app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Selamat datang di API Backend DekorYuk!' });
});

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

    const sessionToken = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET as string, { expiresIn: '7d' });
    return res.status(200).json({ message: 'Login Google berhasil.', token: sessionToken, user });

} catch (error) {
    return res.status(500).json({ message: 'Gagal memproses autentikasi Google.' });
}
});

app.post('/auth/magic-link', async (req: Request, res: Response): Promise<any> => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: 'Email wajib diisi.' });

        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) user = await prisma.user.create({ data: { email } });

        const magicToken = jwt.sign({ userId: user.id, email: user.email, purpose: 'magic-link' }, process.env.JWT_SECRET as string, { expiresIn: '15m'});
        const magicUrl = `${process.env.CLIENT_URL || 'http://localhost:300'}/auth/verify?token=${magicToken}`;

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

app.post('/auth/verivy-magic-link', async (req: Request, res: Response): Promise<any> => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ message: 'Token wajib disertakan.' });

        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
        if (decoded.purpose !== 'magic-link') return res.status(400).json({ message: "Token tidak sah!" });

        const user = await prisma.user.findUnique({ where: { id:decoded.userId} });
        if (!user) return res.status(404).json({ message: ' Pengguna tidak ditemukan.' });

        const sessionToken = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET as string, { expiresIn: '7d' });
        return res.status(200).json({ message: 'Verifikasi berhasil', token: sessionToken,user });
    } catch (error) {
        return res.status(401).json ({ message: 'Tautan kadaluwarsa atau tidak valid.' })
    }
});



// Menjalankan Server
app.listen(PORT, () => {
  console.log(`Server Express berjalan di http://localhost:${PORT}`);
});