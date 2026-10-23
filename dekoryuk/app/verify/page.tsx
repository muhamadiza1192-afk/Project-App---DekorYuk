'use client'

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"

function VerifyContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get('token');
    const [message, setMessage] = useState('Sedang memverifikasi token anda ...');

    useEffect (() => {
        if (!token) {
            setMessage('❌ Token tidak ditemukan di URL.');
        return;
        };
        
        const verifyMagicLink = async () => {
            try {
                const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
                const response = await fetch(`${API_URL}/auth/verify-magic-link`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token }),
                });

                const data = await response.json();

                if (response.ok) {
                    setMessage(`✅ Verifikasi berhasil! Mengalihkan Anda...`);
                    localStorage.setItem('accessToken', data.token);

                    setTimeout(() => {
                        router.push('/dashboard');
                    }, 2000);
                } else {
                    setMessage(`❌ Gagal: ${data.message || 'Token tidak valid atau kedaluwarsa'}`);
                }
                
            } catch (error) {
                setMessage('❌ Gagal terhubung ke server backend.');
            }
        };
        verifyMagicLink();
    }, [token,router]);

    return (
        <div className="bg-white p-8 rounded-xl shadow-md text-center">
      <h1 className="text-xl font-bold mb-4">Verifikasi Akun</h1>
      <p className="text-gray-600">{message}</p>
    </div>
  );
}

export default function VerifyPage(){
    return (
        <main className="min-h-screen flex items-center justify-center bg-gray-50 text-black">
            <Suspense fallback={<p>Memuat ...</p>}>
                <VerifyContent />
            </Suspense>
        </main>
    );
}
