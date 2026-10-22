'use client';

import React, { useState, useRef, useEffect } from 'react';
// Mengimpor ikon-ikon yang dibutuhkan dari lucide-react
import { Home, Image as ImageIcon, Sparkles, Eye, Check, PaintRoller, ImagePlus, RotateCcw, Download, Plus, ZoomIn, ZoomOut } from 'lucide-react';



export default function DashboardPage() {
  // Method useState ini berfungsi sebagai sakelar (switch) on/off
  // false = pop-up disembunyikan | true = pop-up dimunculkan
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [originalData, setOriginalData] = useState<ImageData | null>(null);
  const [paintedData, setPaintedData] = useState<ImageData | null>(null);
  const [wallMask, setWallMask] = useState<Uint8Array | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1)

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const colors = [
    {id: 'asli', name: 'Asli', hex: '#ffffff' },
    {id: 'sage', name: 'Sage', hex: '#829d88' },
    {id: 'beige', name: 'Beige', hex: '#d3c6bc' },
    {id: 'biru', name: 'Biru', hex: '#7ba0b9' },
    {id: 'terakota', name: 'Terakota', hex: '#c26046' }
  ]
 const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Mohon pilih file gambar (JPG atau PNG)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.src = e.target?.result as string;
      
      img.onload = () => {
        // Buat kanvas sementara untuk mengecilkan ukuran gambar jika terlalu besar (maksimal lebar/tinggi 1200px)
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1200;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        // Ubah gambar yang sudah dikompresi menjadi Data URL siap pakai
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
        
        setImageSrc(compressedBase64);
        setSelectedColor('');
      };
    };

    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (!imageSrc) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const img = new window.Image();
    img.src = imageSrc;
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const hRatio = canvas.width / img.width;
      const vRatio = canvas.height / img.height;
      const ratio = Math.min(hRatio, vRatio);
      const centerShift_x = (canvas.width - img.width * ratio) / 2;
      const centerShift_y = (canvas.height - img.height * ratio) / 2;

      ctx.drawImage(img, 0, 0, img.width, img.height, centerShift_x, centerShift_y, img.width * ratio, img.height * ratio);

      try {
        const initialData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setOriginalData(initialData);
        setPaintedData(initialData);
      } catch (err) {
        console.error("Gagal mengambil data piksel kanvas:", err);
      }
    };
  }, [imageSrc]);

  const rgbToHsl = (r: number, g: number, b: number) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return [h * 360, s * 100, l * 100];
  };

  const hexToRgb = (hex: string): [number, number, number] | null => {
    const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!match) return null;
    return [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)];
  };

  // 1. FUNGSI BARU: Mengecat hanya pada area yang sudah diseleksi
  const applyColorToMask = (mask: Uint8Array, colorHex: string) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !originalData) return;

    // Ambil kanvas murni sebagai dasar
    const newImageData = new ImageData(
      new Uint8ClampedArray(originalData.data),
      originalData.width,
      originalData.height
    );
    const pixels = newImageData.data;

    // MODE 1: JIKA WARNA KOSONG (SELEKSI DINDING)
    if (!colorHex || colorHex === 'transparent') {
      for (let i = 0; i < mask.length; i++) {
        if (mask[i] === 1) {
          const pos = i * 4;
          // Kurangi intensitas cahaya asli (gelapkan sedikit) sebagai penanda
          pixels[pos] = Math.max(0, pixels[pos] - 40);
          pixels[pos + 1] = Math.max(0, pixels[pos + 1] - 40);
          pixels[pos + 2] = Math.max(0, pixels[pos + 2] - 40);
        }
      }
      ctx.putImageData(newImageData, 0, 0);
      setPaintedData(newImageData); // Simpan status gelap
      return; // Berhenti di sini, jangan lanjut ke bawah
    }

    // MODE 2: JIKA ADA WARNA PILIHAN (MEWARNAI DINDING)
    const rgb = hexToRgb(colorHex);
    if (!rgb) return;
    const [fillR, fillG, fillB] = rgb;

    for (let i = 0; i < mask.length; i++) {
      if (mask[i] === 1) {
        const pos = i * 4;
        
        // Ambil warna asli piksel dinding
        const origR = originalData.data[pos];
        const origG = originalData.data[pos + 1];
        const origB = originalData.data[pos + 2];

        // Rumus Multiply standar (untuk mendapatkan bayangan)
        const multR = (origR * fillR) / 255;
        const multG = (origG * fillG) / 255;
        const multB = (origB * fillB) / 255;

        // EFEK SOFT: Campurkan 60% warna cat baru dengan 40% cahaya asli dinding
        // Ini membuat warna terlihat lebih pastel, ringan, dan tidak terlalu mencolok/pekat
        pixels[pos]     = Math.round(multR * 0.6 + origR * 0.4);
        pixels[pos + 1] = Math.round(multG * 0.6 + origG * 0.4);
        pixels[pos + 2] = Math.round(multB * 0.6 + origB * 0.4);
      }
    }

    ctx.putImageData(newImageData, 0, 0);
    setPaintedData(newImageData);
  };

  // 2. DIUBAH: Saat warna di palet dipilih, langsung cat dinding yang sudah diseleksi
  const handleColorSelect = (hex: string) => {
    setSelectedColor(hex);
    if (wallMask) {
      applyColorToMask(wallMask, hex);
    }
  };

  const handleReset = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && originalData) {
      ctx.putImageData(originalData, 0, 0);
      setPaintedData(originalData);
      setWallMask(null);
      setSelectedColor('') // Hapus memori dinding saat di-reset
    }
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const link = document.createElement('a');
      link.download = 'Ruangan-DekorYuk.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  };

  // 3. DIUBAH TOTAL: Klik kanvas sekarang tugasnya hanya MENYELEKSI batas ruang
  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !originalData) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const startX = Math.round(event.clientX - rect.left) * scaleX;
    const startY = Math.round(event.clientY - rect.top) * scaleY;

    // Pastikan algoritma selalu merayap berdasarkan warna foto ASLI, bukan foto yang sudah dicat
    const pixels = originalData.data;

    const startPos = (startY * canvas.width + startX) * 4;
    const targetR = pixels[startPos];
    const targetG = pixels[startPos + 1];
    const targetB = pixels[startPos + 2];

    const tolerance = 75;

    const matchColor = (pos: number) => {
      const r = pixels[pos];
      const g = pixels[pos + 1];
      const b = pixels[pos + 2];

      if (r < 30 && g < 30 && b < 30) return false;

      const rDiff = r - targetR;
      const gDiff = g - targetG;
      const bDiff = b - targetB;
      
      // Jarak 3D RGB tidak akan tertipu oleh hilangnya saturasi cahaya
      const distance = Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);

      return distance <= tolerance;
    };

    const queue: [number, number][] = [[startX, startY]];

    const currentMask = wallMask || new Uint8Array(canvas.width * canvas.height);
    const newMask = new Uint8Array(currentMask);

    while (queue.length > 0) {
      const [curX, curY] = queue.pop()!;
      const curPos = (curY * canvas.width + curX) * 4;
      const visitedIndex = curY * canvas.width + curX;

      if (newMask[visitedIndex]) continue;
      newMask[visitedIndex] = 1; // 1 = Area ini diakui sebagai dinding terpilih

      if (matchColor(curPos)) {
        if (curX > 0) queue.push([curX - 1, curY]);
        if (curX < canvas.width - 1) queue.push([curX + 1, curY]);
        if (curY > 0) queue.push([curX, curY - 1]);
        if (curY < canvas.height - 1) queue.push([curX, curY + 1]);
      }
    }

    setWallMask(newMask);
    if (selectedColor) {
      applyColorToMask(newMask, selectedColor);
    } else {
      applyColorToMask(newMask, '');
    }
  };

  const handleAutoDetectWall = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !originalData) return;

    const pixels = originalData.data;
    const width = canvas.width;
    const height = canvas.height;

    // Ambil warna referensi dari area tengah-atas gambar
    const sampleX = Math.floor(width / 2);
    const sampleY = Math.floor(height / 4);
    const startPos = (sampleY * width + sampleX) * 4;

    const targetR = pixels[startPos];
    const targetG = pixels[startPos + 1];
    const targetB = pixels[startPos + 2];

    const tolerance = 75;
    const newMask = new Uint8Array(width * height);

    // Scan seluruh kanvas tanpa mempedulikan halangan objek
    for (let i = 0; i < width * height; i++) {
      const pos = i * 4;
      const r = pixels[pos];
      const g = pixels[pos + 1];
      const b = pixels[pos + 2];

      if (r < 30 && g < 30 && b < 30) continue;

      const rDiff = r - targetR;
      const gDiff = g - targetG;
      const bDiff = b - targetB;
      const distance = Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);

      if (distance <= tolerance) {
        newMask[i] = 1; 
      }
    }

    setWallMask(newMask);
    if (selectedColor) {
      applyColorToMask(newMask, selectedColor);
    } else {
      applyColorToMask(newMask, '');
    }
  };

  const handleShowOriginal = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && originalData) ctx.putImageData(originalData, 0, 0);
  }

  const handleRestorePainted = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && paintedData) ctx.putImageData(paintedData, 0, 0);
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans flex flex-col max-w-md mx-auto relative pb-10 shadow-2xl">
      
      {/* Bagian Navigasi Atas */}
      <div className="flex justify-between items-center px-6 py-5">
        <div className="flex items-center gap-1.5 text-[#c26046]">
          <div className="relative">
            <Home size={32} strokeWidth={2.5} />
            <PaintRoller size={16} className="absolute -bottom-1 -right-2" strokeWidth={3} /> 
            </div>
          <span className="font-bold text-[#A1583D] text-2xl tracking-tight ml-1">DekorYuk</span>
        </div>
        <div className="w-10 h-10 rounded-full bg-gray-300 overflow-hidden border border-gray-200">
          <img src="https://i.pravatar.cc/150?img=5" alt="User Profile" className="w-full h-full object-cover" />
        </div>
      </div>

      {/* Sapaan Pengguna */}
      <div className="px-5 mt-2">
        {!imageSrc ? (
          <div className="border-[1.5px] border-dashed border-[#C26046] rounded-[2rem] flex flex-col items-center justify-center text-center bg-[#FDFCF8] h-[520px] relative px-6 shadow-sm">
            <div className="mb-8 w-48 h-48 bg-[#F6EDE9] rounded-full flex items-center justify-center relative">
              <div className="absolute top-8 left-8 w-16 h-20 bg-[#D3C6BC] rounded opacity-50 rotate-[-10deg]"></div>
              <div className="absolute top-10 right-8 w-14 h-16 bg-[#829D88] rounded opacity-50 rotate-[12deg]"></div>
              <ImagePlus size={64} className="text-[#C26046] relative z-10" strokeWidth={1.5} />
              <div className="absolute -bottom-2 right-10 bg-[#829D88] text-white p-2 rounded-full border-4 border-[#FDFCF8]">
                 <ImageIcon size={20} />
              </div>
            </div>

            <h2 className="text-[26px] font-serif dont-bold text-[#1a1a1a] mb-3 leading-tight">Upload your<br/>room photo</h2>
            <p className="text-gray-500 mb-8 text-[15px]">Tambahkan foto ruangan baru</p>

            <label htmlFor="file-upload" className="bg-[#c26046] text-white px-8 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 w-[85%] transition shadow-md active:scale-95 cursor-pointer">
              <ImageIcon size={20} /> Upload Foto
              <input type="file" id="file-upload" className="hidden" accept="image/*" onChange={handleImageUpload}/>
            </label>
            <p className="text-[13px] text-gray-400 mt-4 font-medium">JPG atau PNG</p>
            </div>
        ) : (
          <div className="relative h-[520px] shadow-lg border border-gray-100 bg-gray-200 overflow-hidden">
            
            {/* KOTAK PEMBUNGKUS DENGAN SCROLL OTOMATIS */}
            <div className="w-full h-full overflow-auto relative flex items-center justify-center">
              <div 
                className="transition-transform duration-200 origin-center"
                style={{ transform: `scale(${zoomLevel})` }}
              >
                <canvas 
                  ref={canvasRef}
                  width={400}
                  height={520}
                  className="cursor-crosshair block"
                  onClick={handleCanvasClick} 
                />
              </div>
            </div>

            {/* CONTROLLER ZOOM DI POJOK KANAN BAWAH */}
            <div className="absolute bottom-5 right-5 bg-white/95 backdrop-blur-md rounded-full flex items-center shadow-md border border-gray-100 z-10 overflow-hidden">
              <button 
                onClick={() => setZoomLevel(prev => Math.max(1, prev - 0.5))}
                className="p-2.5 text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition"
                title="Perkecil"
              >
                <ZoomOut size={18} />
              </button>
              <div className="w-[1px] h-5 bg-gray-200"></div>
              <button 
                onClick={() => setZoomLevel(prev => Math.min(3, prev + 0.5))}
                className="p-2.5 text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition"
                title="Perbesar"
              >
                <ZoomIn size={18} />
              </button>
            </div>

            <button 
              onClick={handleAutoDetectWall}
              className="absolute top-5 left-5 bg-white/95 hover:bg-teal-50 active:scale-95 transition backdrop-blur-md px-3 py-2 rounded-full flex items-center gap-2 shadow-sm border border-gray-100 cursor-pointer z-10"
            >
              <Sparkles size={16} className="text-[#2dd4bf]" />
              <span className="text-xs font-bold text-gray-800">Deteksi Otomatis</span>
            </button>

            <div 
            onMouseDown={handleShowOriginal}
            onMouseUp={handleRestorePainted}
            onMouseLeave={handleRestorePainted}
            className="absolute top-5 right-5 bg-white/95 backdrop-blor-md px-3 py-2 rounded-full flex items-center gap-2 shadow-sm border border-gray-100 cursor-pointer active:scal-95 transition select-none z-10"
            >
              <Eye size={16} className="text-gray-700"/>
              <span className="text-xs font-bold text-gray-800">Sembunyikan seleksi</span>
            </div>

            {selectedColor !== 'transparent' &&(
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-black-70 text-white px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap animate-pulse backdrop-clur-sm pointer-events-none">
                👆 Ketuk area dinding untuk mewarnai
              </div>
            )}
          </div>
        )}

        <div className="flex justify-center items-center gap-2 mt-6">
          <div className={`w-2.5 h-2.5 rounded-full transition-all ${!imageSrc ? 'bg-[#c26046] w-6' : 'bg-[#d9d9d9]'}`}></div>
          <div className={`w-2.5 h-2.5 rounded-full transition-all ${imageSrc ? 'bg-[#c26046] w-6' : 'bg-[#d9d9d9]'}`}></div>
        </div>
      </div>


<div className={`px-6 mt-8 transition-opacity duration-500 ${imageSrc ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-[22px] font-serif font-bold text-[#1A1A1A]">Pilih warna</h3>
          
          {/* Label Hex Code Pintar (Hanya muncul jika warna sudah dipilih) */}
          {selectedColor && (
            <span className="text-[13px] font-bold text-gray-500 bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-full uppercase tracking-widest shadow-inner">
              {selectedColor}
            </span>
          )}
        </div>
        
        <div className="flex justify-between items-center">
          {/* Loop Warna Bawaan */}
          {colors.map(color => (
            <div key={color.id} className="flex flex-col items-center gap-2.5">
              <button 
                onClick={() => handleColorSelect(color.hex)}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${selectedColor === color.hex ? 'ring-[3px] ring-offset-[2px] ring-[#C26046]' : 'border border-gray-200 hover:scale-105 shadow-sm'}`}
                style={{ backgroundColor: color.hex }}
              >
                {selectedColor === color.hex && <Check size={22} className={color.id === 'putih' ? 'text-gray-400' : 'text-white drop-shadow-md'} />}
              </button>
              <span className="text-[12px] text-[#4A4A4A] font-medium">{color.name}</span>
            </div>
          ))}

          {/* Tombol Lingkaran Warna Kustom (Warna Lain) */}
          <div className="flex flex-col items-center gap-2.5 relative">
            {/* Input asli disembunyikan */}
            <input type="color" id="custom-color-picker" className="absolute opacity-0 w-0 h-0" onChange={(e) => handleColorSelect(e.target.value)} />
            <button 
              onClick={() => document.getElementById('custom-color-picker')?.click()}
              className="w-12 h-12 rounded-full flex items-center justify-center shadow-sm p-[2px] border border-gray-200 hover:scale-105 transition-all"
            >
              <div className="w-full h-full rounded-full bg-gradient-to-tr from-[#3B82F6] via-[#10B981] to-[#EF4444] flex items-center justify-center">
                 <Plus size={20} className="text-white drop-shadow-md" />
              </div>
            </button>
            <span className="text-[12px] text-[#4A4A4A] font-medium">Lainnya</span>
          </div>
        </div>

        {/* Tombol Reset dan Simpan (Dibelah Dua) */}
        <div className="flex gap-4 mt-8 w-full pb-6">
          <button 
            onClick={handleReset} 
            className="flex-1 bg-white border-[1.5px] border-gray-200 py-3.5 rounded-2xl font-bold text-gray-700 hover:bg-gray-50 active:scale-95 transition shadow-sm flex items-center justify-center gap-2"
          >
            <RotateCcw size={18} /> Reset
          </button>
          <button 
            onClick={handleSave} 
            className="flex-1 bg-[#C26046] py-3.5 rounded-2xl font-bold text-white hover:bg-[#A54F38] active:scale-95 transition shadow-sm flex items-center justify-center gap-2"
          >
            <Download size={18} /> Simpan
          </button>
        </div>
      </div>

    </div>
  );
}