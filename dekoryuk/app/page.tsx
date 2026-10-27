'use client';

import React, { useState } from 'react';
// Kita mengimpor ikon dari plugin lucide-react yang baru saja diinstal
import { Mail, Zap, ShieldCheck, Palette } from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';

export default function LoginPage() {
  // useState: Ingatan jangka pendek untuk menyimpan ketikan email
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSuccess = async (credentialResponse: any) => {
    setIsLoading(true);
    setMessage('Memverifikasi akun Google...');

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const response = await fetch(`${API_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: credentialResponse.credential }) // Mengirim token ke backend
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('accessToken', data.token); // Simpan tiket masuk
        setMessage('✅ Login berhasil! Mengalihkan...');
        window.location.href = '/dashboard'; // Alihkan ke ruang kerja
      } else {
        setMessage(`❌ Gagal: ${data.message}`);
      }
    } catch (error) {
      setMessage('❌ Terjadi kesalahan saat menghubungi server.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email.trim()) {
      setMessage('Masukkan alamat email terlebih dahulu.');
      return;
    }

    setIsLoading(true);
    setMessage('Mengirim magic link...');
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const response = await fetch(`${API_URL}/auth/magic-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await response.json();
      setMessage(response.ok
        ? 'Magic link telah dikirim. Periksa email Anda.'
        : `❌ Gagal: ${data.message || 'Tidak dapat mengirim magic link.'}`);
    } catch {
      setMessage('❌ Terjadi kesalahan saat menghubungi server.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <GoogleOAuthProvider clientId="32507370473-ek1jl7mlslaprgf8mge34e07lq4f0rgl.apps.googleusercontent.com">
    <div className="min-h-screen bg-[#FDFCF8] flex flex-col items-center py-10 px-5 font-sans">
      
      {/* Header & Title */}
      <div className="text-center mb-8 mt-4">
        <span className="bg-[#DCE7D5] text-[#4A6342] text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
          AI Room Visualizer
        </span>
        <h1 className="text-3xl font-extrabold mt-4 flex items-center justify-center gap-2 text-[#333333]">
          <div className="w-6 h-6 bg-[#A1583D] rounded-sm flex items-center justify-center text-white text-sm">T</div> 
          DekorYuk
        </h1>
        <p className="text-sm text-gray-500 mt-2 max-w-[260px] mx-auto leading-relaxed">
          Wujudkan warna ruangan impianmu dalam hitungan detik.
        </p>
      </div>

      {/* Auth Card (Kotak Login) */}
      <div className="w-full max-w-sm bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
        
        {/* Tombol Google */}
        <div className="flex justify-center">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setMessage('❌ Login Google dibatalkan.')}
            text="continue_with"
            shape="pill"
            width="320"
          />
        </div>

        <div className="flex items-center my-6 text-gray-400 text-xs font-medium">
          <div className="flex-1 border-t border-gray-100"></div>
          <span className="px-3">atau dengan email</span>
          <div className="flex-1 border-t border-gray-100"></div>
        </div>

        {/* Input Email */}
        <div className="mb-4">
          <label className="block text-xs font-bold text-gray-500 mb-2">Alamat Email</label>
          <div className="relative">
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contoh: arsitek@dekoryuk.com" 
              className="w-full bg-[#FDFCF8] border border-gray-100 rounded-xl py-3.5 pl-11 pr-4 text-sm focus:ring-2 focus:ring-[#A1583D]/20 focus:border-[#A1583D] outline-none transition" 
            />
            {/* Menggunakan ikon Mail dari lucide-react */}
            <Mail className="w-5 h-5 absolute left-4 top-3.5 text-gray-400" />
          </div>
        </div>

        {/* Tombol Magic Link */}
        <button 
          onClick={handleMagicLink}
          disabled={isLoading}
          className={`w-full text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition shadow-md ${
            isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#A1583D] hover:bg-[#8A4931] active:scale-95 shadow-[#A1583D]/20'
          }`}
        >
          <Zap className="w-4 h-4" />
          {isLoading ? 'Memproses...' : 'Kirim Magic Link'}
        </button>

        {/* Menampilkan pesan sukses/error */}
        {message && (
          <p className="text-xs text-center mt-4 font-medium text-gray-600">
            {message}
          </p>
        )}
      </div>

      {/* Info Badges (Keuntungan) */}
      <div className="flex gap-3 w-full max-w-sm mt-4">
        <div className="flex-1 bg-[#FDFCF8] border border-gray-100 rounded-xl p-3 flex items-start gap-2">
           <ShieldCheck className="w-5 h-5 text-[#4A6342] flex-shrink-0" />
           <p className="text-[10px] text-gray-500 font-medium leading-tight mt-0.5">Tanpa perlu repot ingat password</p>
        </div>
        <div className="flex-1 bg-[#FDFCF8] border border-gray-100 rounded-xl p-3 flex items-start gap-2">
           <Palette className="w-5 h-5 text-[#A1583D] flex-shrink-0" />
           <p className="text-[10px] text-gray-500 font-medium leading-tight mt-0.5">100+ Palet cat lokal Indonesia</p>
        </div>
      </div>
      
    </div>
    </GoogleOAuthProvider>
  );
}