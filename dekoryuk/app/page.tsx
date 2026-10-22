'use client';

import React, { useState } from 'react';
// Kita mengimpor ikon dari plugin lucide-react yang baru saja diinstal
import { Mail, Zap, ShieldCheck, Palette } from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';

export default function LoginPage() {
  // useState: Ingatan jangka pendek untuk menyimpan ketikan email
  const [email, setEmail] = useState('');

  return (
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
        <button className="w-full bg-[#FDFCF8] border border-gray-200 text-[#333333] font-bold py-3.5 rounded-xl flex items-center justify-center gap-3 hover:bg-gray-50 transition active:scale-95">
          <FcGoogle className="w-6 h-6" />
          Lanjutkan dengan Google
        </button>

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
          onClick={() => alert(`Email magic link akan dikirim ke: ${email}`)}
          className="w-full bg-[#A1583D] text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-[#8A4931] transition active:scale-95 shadow-md shadow-[#A1583D]/20"
        >
          {/* Menggunakan ikon Zap dari lucide-react */}
          <Zap className="w-4 h-4" />
          Kirim Magic Link
        </button>
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
  );
}