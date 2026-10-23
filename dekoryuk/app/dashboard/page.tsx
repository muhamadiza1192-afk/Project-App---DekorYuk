'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Home, Image as ImageIcon, Camera, Sparkles, Eye, Check, PaintRoller, ImagePlus, RotateCcw, Download, Plus, ZoomIn, ZoomOut, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Toaster, toast } from 'react-hot-toast';
import Script from 'next/script'; // Tambahkan ini di deretan import

export default function DashboardPage() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [originalData, setOriginalData] = useState<ImageData | null>(null);
  const [paintedData, setPaintedData] = useState<ImageData | null>(null);
  const [wallMask, setWallMask] = useState<Uint8Array | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isMounted, setIsMounted] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  const [userProfile, setUserProfile] = useState({
    name: 'Pengguna',
    picture: 'https://ui-avatars.com/api/?name=User&background=F6EDE9&color=C26046',
    plan: 'Pemula' // Default class/perk
  });


  const [debugMsg, setDebugMsg] = useState('Menunggu foto...'); 

  const [savedProjects, setSavedProjects] = useState<any[]>([]);

  const fetchProjects = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const response = await fetch(`${API_URL}/api/projects`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSavedProjects(data);
      }
    } catch (error) {
      console.error("Gagal memuat proyek:", error);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const router = useRouter();

  useEffect(() => {
    setIsMounted(true);
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.push('/');
      return;
    }
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setUserProfile({
          name: parsed.name || 'Pengguna',
          // Prioritaskan foto dari Google, jika tidak ada pakai inisial nama
          picture: parsed.picture || parsed.avatarUrl || `https://ui-avatars.com/api/?name=${parsed.name || 'User'}&background=F6EDE9&color=C26046`,
          plan: parsed.plan || 'Pemula'
        });
      } catch (e) {
        console.error("Gagal membaca profil");
      }
    }
  }, [router]);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const carouselRef = useRef<HTMLDivElement>(null);
  const [activeSlide, setActiveSlide] = useState(0);

  const handleScroll = () => {
    if (!carouselRef.current) return;
    const scrollPosition = carouselRef.current.scrollLeft;
    const slideWidth = carouselRef.current.clientWidth;
    const currentSlide = Math.round(scrollPosition / slideWidth);
    setActiveSlide(currentSlide);
  };

  const scrollToSlide = (index: number) => {
    if (!carouselRef.current) return;
    carouselRef.current.scrollTo({
      left: index * carouselRef.current.clientWidth,
      behavior: 'smooth'
    });
  };

  const colors = [
    { id: 'asli', name: 'Asli', hex: '#ffffff' },
    { id: 'sage', name: 'Sage', hex: '#829d88' },
    { id: 'beige', name: 'Beige', hex: '#d3c6bc' },
    { id: 'biru', name: 'Biru', hex: '#7ba0b9' },
    { id: 'terakota', name: 'Terakota', hex: '#c26046' }
  ];

  // Fungsi Upload Ringan (Aman untuk RAM HP)
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    setDebugMsg('Memulai proses...');
    
    try {
      const file = event.target.files?.[0];
      
      if (!file) {
        setDebugMsg('GAGAL: File ditahan oleh keamanan browser HP.');
        return;
      }

      setDebugMsg(`Berhasil membaca: ${file.name}. Menggambar...`);

      const imageUrl = URL.createObjectURL(file);
      setImageSrc(imageUrl);
      setSelectedColor('');
      
      setDebugMsg('Selesai!');

      setTimeout(() => scrollToSlide(0), 300);
    } catch (error: any) {
      setDebugMsg(`ERROR: ${error.message || "Terjadi kesalahan tidak dikenal"}`);
    }
  };

  // Urutan Render Gambar Anti-Race Condition
  useEffect(() => {
    if (!imageSrc) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !ctx) return;

    const img = new window.Image();
    
    // 1. Daftarkan onload terlebih dahulu
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

    // 2. Terapkan src di paling akhir
    img.src = imageSrc;
  }, [imageSrc]);

  const hexToRgb = (hex: string): [number, number, number] | null => {
    const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!match) return null;
    return [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)];
  };

  const applyColorToMask = (mask: Uint8Array, colorHex: string) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !originalData) return;

    const newImageData = new ImageData(
      new Uint8ClampedArray(originalData.data),
      originalData.width,
      originalData.height
    );
    const pixels = newImageData.data;

    if (!colorHex || colorHex === 'transparent' || colorHex === '#ffffff') {
      for (let i = 0; i < mask.length; i++) {
        if (mask[i] === 1) {
          const pos = i * 4;
          pixels[pos] = Math.max(0, pixels[pos] - 40);
          pixels[pos + 1] = Math.max(0, pixels[pos + 1] - 40);
          pixels[pos + 2] = Math.max(0, pixels[pos + 2] - 40);
        }
      }
      ctx.putImageData(newImageData, 0, 0);
      setPaintedData(newImageData);
      return;
    }

    const rgb = hexToRgb(colorHex);
    if (!rgb) return;
    const [fillR, fillG, fillB] = rgb;

    for (let i = 0; i < mask.length; i++) {
      if (mask[i] === 1) {
        const pos = i * 4;
        const origR = originalData.data[pos];
        const origG = originalData.data[pos + 1];
        const origB = originalData.data[pos + 2];

        const multR = (origR * fillR) / 255;
        const multG = (origG * fillG) / 255;
        const multB = (origB * fillB) / 255;

        pixels[pos]     = Math.round(multR * 0.6 + origR * 0.4);
        pixels[pos + 1] = Math.round(multG * 0.6 + origG * 0.4);
        pixels[pos + 2] = Math.round(multB * 0.6 + origB * 0.4);
      }
    }

    ctx.putImageData(newImageData, 0, 0);
    setPaintedData(newImageData);
  };

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
      setSelectedColor('');
    }
  };

  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const base64image = canvas.toDataURL('image/png');
    const token = localStorage.getItem('accessToken');

    if (!token) {
      setDebugMsg('GAGAL: Anda belum login.');
      return;
    }
    const toastId = toast.loading('Sedang menyimpan ke galeri...');
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http:localhost:5000';
      const response = await fetch(`${API_URL}/api/projects`, {
        method: 'POST',
        headers: {
          'Content-type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          image:base64image,
          name: 'Desain Ruangan ' + new Date().toLocaleDateString(),
          colorHex: selectedColor || '#ffffff'
        })
      });
      const data = await response.json();

      if (response.ok) {
        toast.success('Karya berhasil disimpan!', { id: toastId });

        fetchProjects();

        const link = document.createElement('a');
        link.download = 'Ruangan-DekorYuk.png';
        link.href = base64image;
        link.click();
      } else {
        toast.error(`Gagal menyimpan: ${data.message}`, { id: toastId });

        if (response.status === 403) {
          setIsUpgradeModalOpen(true);
        }
      }

    } catch (error) {
      toast.error('Error: Gagal terhubung ke server', { id: toastId });
    }
  };

  const handleUpgrade = async (planToBuy: string) => {
    const toastId = toast.loading('Menyiapkan pembayaran...');
    try {
      const token = localStorage.getItem('accessToken');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      
      const response = await fetch(`${API_URL}/api/payment/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ plan: planToBuy })
      });
      
      const data = await response.json();
      
      if (response.ok && data.token) {
        toast.dismiss(toastId);
        setIsUpgradeModalOpen(false); // Tutup modal
        
        // Panggil Popup Midtrans Snap
        (window as any).snap.pay(data.token, {
          onSuccess: function(result: any) {
            toast.success('Pembayaran Berhasil! Mengaktifkan paket Anda...');
            // Nanti kita buat fungsi update status setelah ini

            const updatedProfile = { ...userProfile, plan: result.gross_amount === '50000.00' ? 'pro' :'pelajar' };
            setUserProfile(updatedProfile);
            localStorage.setItem('user', JSON.stringify(updatedProfile));

            setTimeout(() => window.location.reload(), 1500);
          },
          onPending: function(result: any) {
            toast.success('Menunggu pembayaran Anda diselesaikan.');
          },
          onError: function(result: any) {
            toast.error('Pembayaran gagal atau dibatalkan.');
          },
          onClose: function() {
            toast.error('Anda menutup layar pembayaran.');
          }
        });
      } else {
        toast.error(`Gagal: ${data.message}`, { id: toastId });
      }
    } catch (error) {
      toast.error('Gagal terhubung ke server.', { id: toastId });
    }
  };

  // Menggunakan PointerEvent dan Math.floor untuk akurasi sentuhan HP
  const handleCanvasClick = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !originalData) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const startX = Math.floor((event.clientX - rect.left) * scaleX);
    const startY = Math.floor((event.clientY - rect.top) * scaleY);

    if (startX < 0 || startX >= canvas.width || startY < 0 || startY >= canvas.height) return;

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
      newMask[visitedIndex] = 1; 

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

    const sampleX = Math.floor(width / 2);
    const sampleY = Math.floor(height / 4);
    const startPos = (sampleY * width + sampleX) * 4;

    const targetR = pixels[startPos];
    const targetG = pixels[startPos + 1];
    const targetB = pixels[startPos + 2];

    const tolerance = 75;
    const newMask = new Uint8Array(width * height);

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

  if (!isMounted) return null;

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans flex flex-col w-full max-w-xl mx-auto relative pb-10 shadow-2xl sm:border-x sm:border-gray-200">

      <Toaster position="top-center" reverseOrder={false} />
      <Script src="https://app.sandbox.midtrans.com/snap/snap.js" data-client-key={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY} strategy="lazyOnload" />
      
      {/* Bagian Navigasi Atas */}
      <div className="flex justify-between items-center px-6 py-5">
        <div className="flex items-center gap-1.5 text-[#c26046]">
          <div className="relative">
            <Home size={32} strokeWidth={2.5} />
            <PaintRoller size={16} className="absolute -bottom-1 -right-2" strokeWidth={3} /> 
          </div>
          <span className="font-bold text-[#A1583D] text-2xl tracking-tight ml-1">DekorYuk</span>
        </div>
        
        {/* BAGIAN PROFIL & KELAS PENGGUNA */}
        <div className="flex items-center gap-3">
          {/* Badge Class / Perk */}
          <button 
            onClick={() => setIsUpgradeModalOpen(true)}
            className="bg-gradient-to-r from-amber-100 to-yellow-300 text-yellow-800 text-[11px] font-extrabold px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1 border border-yellow-300 uppercase tracking-wide hover:scale-105 active:scale-95 transition cursor-pointer"
          >
            <Sparkles size={12} fill="currentColor" />
            {userProfile.plan}
          </button>
          
          {/* Foto Profil Asli Google */}
          <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden border-2 border-white shadow-sm ring-2 ring-gray-100">
            <img 
              src={userProfile.picture} 
              alt={userProfile.name} 
              className="w-full h-full object-cover" 
            />
          </div>
        </div>
      </div>

      {/* Area Utama */}
      <div className="mt-2 relative w-full overflow-hidden">
        <div 
          ref={carouselRef}
          onScroll={handleScroll}
          className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth w-full pb-4"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {/* SLIDE 1: KANVAS UTAMA ATAU UPLOAD AWAL */}
          <div className="min-w-full snap-center px-5 flex flex-col">
            {!imageSrc ? (
              // Tampilan Upload Awal (Sama seperti kode Anda sebelumnya)
              <div className="border-[1.5px] border-dashed border-[#C26046] rounded-[2rem] flex flex-col items-center justify-center text-center bg-[#FDFCF8] h-[520px] relative px-6 shadow-sm">
                <div className="mb-8 w-48 h-48 bg-[#F6EDE9] rounded-full flex items-center justify-center relative">
                  <div className="absolute top-8 left-8 w-16 h-20 bg-[#D3C6BC] rounded opacity-50 rotate-[-10deg]"></div>
                  <div className="absolute top-10 right-8 w-14 h-16 bg-[#829D88] rounded opacity-50 rotate-[12deg]"></div>
                  <ImagePlus size={64} className="text-[#C26046] relative z-10" strokeWidth={1.5} />
                </div>
                <h2 className="text-[26px] font-serif font-bold text-[#1a1a1a] mb-3 leading-tight">Upload your<br/>room photo</h2>
                <p className="text-gray-500 mb-8 text-[15px]">Tambahkan foto ruangan baru</p>

                <div className="flex flex-col gap-3 w-[85%]">
                  <input id="kamera-input-1" type="file" accept="image/*" capture="environment" onChange={handleImageUpload} onClick={(e) => { (e.target as HTMLInputElement).value = '' }} style={{ display: 'none' }} />
                  <input id="galeri-input-1" type="file" accept="image/*" onChange={handleImageUpload} onClick={(e) => { (e.target as HTMLInputElement).value = '' }} style={{ display: 'none' }} />
                  
                  <label htmlFor="kamera-input-1" className="bg-white text-[#c26046] border-2 border-[#c26046] px-4 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition">
                    <Camera size={18} /> Gunakan Kamera
                  </label>
                  <label htmlFor="galeri-input-1" className="bg-[#c26046] text-white px-4 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md cursor-pointer active:scale-95 transition">
                    <ImageIcon size={18} /> Buka Galeri
                  </label>
                </div>
              </div>
            ) : (
              // Tampilan Kanvas (Sama seperti kode Anda sebelumnya)
              <div className="relative h-[520px] shadow-lg border border-gray-100 bg-gray-200 overflow-hidden">
                <div className="w-full h-full overflow-auto relative flex items-center justify-center">
                  <div className="transition-transform duration-200 origin-center" style={{ transform: `scale(${zoomLevel})` }}>
                    <canvas ref={canvasRef} width={400} height={520} className="cursor-crosshair block" onPointerDown={handleCanvasClick} style={{ touchAction: 'none' }} />
                  </div>
                </div>

                <div className="absolute bottom-5 right-5 bg-white/95 backdrop-blur-md rounded-full flex items-center shadow-md border border-gray-100 z-10 overflow-hidden">
                  <button onClick={() => setZoomLevel(prev => Math.max(1, prev - 0.5))} className="p-2.5 text-gray-600 hover:bg-gray-100"><ZoomOut size={18} /></button>
                  <div className="w-[1px] h-5 bg-gray-200"></div>
                  <button onClick={() => setZoomLevel(prev => Math.min(3, prev + 0.5))} className="p-2.5 text-gray-600 hover:bg-gray-100"><ZoomIn size={18} /></button>
                </div>

                <button onClick={handleAutoDetectWall} className="absolute top-5 left-5 bg-white/95 hover:bg-teal-50 px-3 py-2 rounded-full flex items-center gap-2 shadow-sm border border-gray-100 z-10">
                  <Sparkles size={16} className="text-[#2dd4bf]" />
                  <span className="text-xs font-bold text-gray-800">Deteksi Otomatis</span>
                </button>

                <div onPointerDown={handleShowOriginal} onPointerUp={handleRestorePainted} onPointerLeave={handleRestorePainted} className="absolute top-5 right-5 bg-white/95 px-3 py-2 rounded-full flex items-center gap-2 shadow-sm border border-gray-100 cursor-pointer select-none z-10">
                  <Eye size={16} className="text-gray-700"/>
                  <span className="text-xs font-bold text-gray-800">Tahan Asli</span>
                </div>
              </div>
            )}
          </div>

          {/* SLIDE 2: MENU UNTUK MEMBUKA CANVAS BARU (Hanya muncul jika sedang mengedit) */}
          {imageSrc && (
            <div className="min-w-full snap-center px-5 flex flex-col justify-center">
              <div className="border-[1.5px] border-dashed border-[#C26046] rounded-[2rem] flex flex-col items-center justify-center text-center bg-[#FDFCF8] h-[520px] relative px-6 shadow-sm">
                
                <div className="mb-6 w-24 h-24 bg-[#F6EDE9] rounded-full flex items-center justify-center relative">
                  <ImagePlus size={40} className="text-[#C26046] relative z-10" strokeWidth={1.5} />
                </div>
                
                <h2 className="text-[22px] font-serif font-bold text-[#1a1a1a] mb-2 leading-tight">Mulai Proyek Baru</h2>
                <p className="text-gray-500 mb-8 text-[14px]">Upload foto lain untuk mengganti kanvas saat ini.</p>

                <div className="flex flex-col gap-3 w-[85%]">
                  <input id="kamera-input-2" type="file" accept="image/*" capture="environment" onChange={handleImageUpload} onClick={(e) => { (e.target as HTMLInputElement).value = '' }} style={{ display: 'none' }} />
                  <input id="galeri-input-2" type="file" accept="image/*" onChange={handleImageUpload} onClick={(e) => { (e.target as HTMLInputElement).value = '' }} style={{ display: 'none' }} />
                  
                  <label htmlFor="kamera-input-2" className="bg-white text-[#c26046] border-2 border-[#c26046] px-4 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition">
                    <Camera size={18} /> Gunakan Kamera
                  </label>
                  <label htmlFor="galeri-input-2" className="bg-[#c26046] text-white px-4 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md cursor-pointer active:scale-95 transition">
                    <ImageIcon size={18} /> Buka Galeri
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* TITIK INDIKATOR YANG BISA DIKLIK */}
      <div className="flex justify-center items-center gap-2 mt-2">
        <button onClick={() => scrollToSlide(0)} className={`h-2.5 rounded-full transition-all duration-300 ${activeSlide === 0 ? 'bg-[#c26046] w-6' : 'bg-[#d9d9d9] w-2.5'}`}></button>
        {imageSrc && (
          <button onClick={() => scrollToSlide(1)} className={`h-2.5 rounded-full transition-all duration-300 ${activeSlide === 1 ? 'bg-[#c26046] w-6' : 'bg-[#d9d9d9] w-2.5'}`}></button>
        )}
      </div>
      <div className={`px-6 mt-8 transition-opacity duration-500 ${imageSrc ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-[22px] font-serif font-bold text-[#1A1A1A]">Pilih warna</h3>
          
          {selectedColor && (
            <span className="text-[13px] font-bold text-gray-500 bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-full uppercase tracking-widest shadow-inner">
              {selectedColor}
            </span>
          )}
        </div>
        
        <div className="flex justify-between items-center">
          {colors.map(color => (
            <div key={color.id} className="flex flex-col items-center gap-2.5">
              <button 
                onClick={() => handleColorSelect(color.hex)}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${selectedColor === color.hex ? 'ring-[3px] ring-offset-[2px] ring-[#C26046]' : 'border border-gray-200 hover:scale-105 shadow-sm'}`}
                style={{ backgroundColor: color.hex }}
              >
                {selectedColor === color.hex && <Check size={22} className={color.id === 'asli' ? 'text-gray-400' : 'text-white drop-shadow-md'} />}
              </button>
              <span className="text-[12px] text-[#4A4A4A] font-medium">{color.name}</span>
            </div>
          ))}

          <div className="flex flex-col items-center gap-2.5 relative">
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
      {/* ========================================== */}
      {/* MODAL PILIH PAKET LANGGANAN                */}
      {/* ========================================== */}
      {isUpgradeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-5">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <button 
              onClick={() => setIsUpgradeModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 bg-gray-100 p-1.5 rounded-full"
            >
              <X size={18} />
            </button>
            
            <h2 className="text-2xl font-serif font-bold text-gray-800 mb-1 text-center">Upgrade Akun</h2>
            <p className="text-gray-500 text-sm text-center mb-6">Pilih paket untuk menghilangkan batas penyimpanan dan watermark.</p>
            
            <div className="flex flex-col gap-4">
              {/* Paket Pelajar */}
              <div className="border-2 border-gray-200 hover:border-[#c26046] rounded-2xl p-4 transition cursor-pointer" onClick={() => handleUpgrade('pelajar')}>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold text-gray-800 text-lg">Pelajar</h3>
                  <span className="font-bold text-[#c26046]">Rp 15.000</span>
                </div>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>✨ Tanpa Watermark</li>
                  <li>💾 Batas simpan 10 desain</li>
                </ul>
              </div>

              {/* Paket Pro */}
              <div className="border-2 border-[#c26046] bg-[#FDFCF8] rounded-2xl p-4 transition cursor-pointer relative overflow-hidden" onClick={() => handleUpgrade('pro')}>
                <div className="absolute top-0 right-0 bg-[#c26046] text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg uppercase tracking-wide">Paling Laris</div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold text-gray-800 text-lg">Pro</h3>
                  <span className="font-bold text-[#c26046]">Rp 50.000</span>
                </div>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>✨ Tanpa Watermark</li>
                  <li>♾️ Bebas simpan tanpa batas</li>
                </ul>
              </div>
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
}