'use client';

import react, { useRef, useState, useEffect } from 'react';
import { X, Bookmark, Undo2, RotateCcw, SplitSquareHorizontal, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function EditorPage() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [selectedColor, setSelectedColor] = useState('#C86D51');
    const router = useRouter ();
    const [history, setHistory] = useState<ImageData[]>([])
    const [originalData, setOriginalData] = useState<ImageData | null>(null);

    const hanldleCancel = () => {
        localStorage.removeItem('dekoryuk_image');
        router.push('/dashboard');
    }

    const hexToRgb = (hex: string) => {
        const cleanHex = hex.replace('#', '');
        const bigint = parseInt(cleanHex, 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        return [r, g, b];
    }

    const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const startX = Math.round(event.clientX - rect.left);
        const startY = Math.round(event.clientY - rect.top);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;

        const startPos = (startY * canvas.width + startX) * 4;
        const targetR = pixels[startPos];
        const targetG = pixels[startPos + 1];
        const targetB = pixels[startPos + 2];

        const [fillR, fillG, fillB] = hexToRgb(selectedColor);
        if (targetR === fillR && targetG === fillG && targetB === fillB) return;
        const tolerance = 45;

        const matchColor = (pos:number) => {
            const r = pixels[pos];
            const g = pixels[pos + 1];
            const b = pixels[pos + 2];
            return Math.abs(r - targetR) <= tolerance &&
                    Math.abs(g - targetG) <= tolerance &&
                    Math.abs(b - targetB) <= tolerance;
        }

        const queue: [number, number][] = [[startX, startY]];
        const visited = new Uint8Array(canvas.width * canvas.height);

        while (queue.length > 0) {
            const [curX, curY] = queue.pop()!;
            const curPos = (curY * canvas.height + curX) * 4;
            const visitedIndex = curY *canvas.width + curX;

            if (visited[visitedIndex]) continue;
            visited[visitedIndex] = 1;

            if (matchColor(curPos)) {
                pixels[curPos] = fillR;
                pixels[curPos + 1] = fillG;
                pixels[curPos + 2] = fillB;

                if (curX > 0) queue.push([curX - 1, curY]);
                if (curX < canvas.width - 1) queue.push([curX + 1, curY]);
                if (curY > 0) queue.push([curX, curY - 1]);
                if (curY < canvas.height - 1) queue.push([curX + 1, curY]);
            }
        }

        ctx.putImageData(imageData, 0, 0);
    }


    const colorPalette = [
        { id: 1, name: 'Terracotta', hex: '#C86D51' },
        { id: 2, name: 'Sage Green', hex: '#87A38E' },
        { id: 3, name: 'Nordic Blue', hex: '#3B5998' },
        { id: 4, name: 'Warm Oat', hex: '#E6D7C3' },
        { id: 5, name: 'Olive Gold', hex: '#A39158' },
    ]

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const savedImage = localStorage.getItem('dekoryuk_image');

        if (savedImage) {
            const img = new window.Image();
            img.src = savedImage;
            img.onload = () => {
                ctx.clearRect(0,0, canvas.width, canvas.height);

                const hRatio = canvas.width / img.width;
                const vRatio = canvas.height / img.height;
                const ratio = Math.min(hRatio, vRatio);
                const centerShift_x = (canvas.width - img.width * ratio) /2;
                const centerShift_y = (canvas.height - img.height * ratio) /2;

                ctx.drawImage(
                    img,0,0, img.width, img.height,
                    centerShift_x, centerShift_y, img.width * ratio, img.height *ratio
                );
                const initialData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            };
                    
        } else {
                // Menggambar dinding dengan warna default
                ctx.fillStyle = '#E8DCD5';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                ctx.fillStyle = selectedColor;
                ctx.font = '16px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('Belum ada foto. Silakan Kembali', canvas.width / 2, canvas.height /2);
            }
    }, []);

return (
    <div className="min-h-screen bg-[#faf8f5] font-sans flex flex-col max-w-md mx-auto shadow-xl relative">
        <div className="flex justify-between items-center p-4 bg-white border-b border=gray-100 z-10">
           <button onClick={hanldleCancel} className="flex items-center gap-1 text-gray-600 hover:text-gray-900 font-medium">
            <X size={20}/>
            <span className="text-sm">Batal</span>
            </button>

            <div className=" flex items-center gap-2 bg-[#f2efeb] px-4 py-1.5 rounded-full">
                <span className="text-[#a1583d] font-bold text-sm">🎨 Studio Dinding</span>
            </div>

            <button className='flex items-center gap-1.5 bg-[#a1583d] text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-[#8a4931] transition shadow-sm'>
                Simpan <Bookmark size={16}/>
            </button>
        </div>

        <div className="relative flex-1 bg-gray-200 overflow-hidden flex items-center justify-center">
            <canvas
            ref={canvasRef}
            width={400}
            height={500}
            className="max-w-full h-auto bg-white shadow-inner"
            onClick={handleCanvasClick}
            style={{ cursor: 'crosshair' }}
            />

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-[10px] font-bold px-3 py-1.5 rounded-full backdrop-blur-md">
            Smart Ai Masking: Siap
        </div>
    </div>

    <div className="bg-[#faf8f5] rounded-t-3xl -mt-4 z-20 p-5 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
       <div className="bg-[#f2efeb] rounded-xl p-3 flex gap-3 items-start mb-5">
        <div className="mt-0.5 text-[#a1583d]">
            <SplitSquareHorizontal size={18}/>
        </div>
        <p className="text-xs text-gray-600 leading-relaxed">
            <span className="font-bold text-[#333333]">Mode Seleksi:</span>Kotakkan objek atau ketuk area menggunakan Magic Wand untuk mewarnai bagian tertentu.
        </p>
        </div> 

        <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-[#333333]">Koleksi Warna Cat</h3>
                <span className="text-xs font-bold text-[#a1583d]">{selectedColor}</span>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {colorPalette.map((color)=> (
                    <div key={color.id} className="flex flex-col items-center gap-1.5 min-w-[64px]">
                        <button
                        onClick={() => setSelectedColor(color.hex)}
                        className={`w-14 h-14 rounded-full shadow-sm transition-all flex items-center justify-center ${selectedColor === color.hex ? 'ring-4 ring-[#a1583d]/ 30 scale-110' : 'ring-1 ring-gray-200 hover:scale-105'}`}
                        style={{ backgroundColor: color.hex }}>
                            {selectedColor === color.hex && <Check size={24} className="text-white drop-shadow-md" />}
                        </button>
                        <span className={`text-[10px] ${selectedColor === color.hex ? 'font-bold text-[#333333]' : 'text-gray-500'}`}>
                           {color.name} 
                        </span>
                    </div>
                ))}
            </div>
        </div>
            <div className="flex gap-2">
                    <button className="flex-1 bg-white border border-gray-200 text-[#333333] py-3 rounded-xl flex items-center justify-center gap-1.5 font-bold text-xs hover:bg-gray-50 active:scale-95 transition shadow-sm">
                        <Undo2 size={16} /> Urungkan
                    </button>
                    <button className="flex-1 bg-white border border-gray-200 text-[#333333] py-3 rounded-xl flex items-center justify-center gap-1.5 font-bold text-xs hover:bg-gray-50 active:scale-95 transition shadow-sm">
                        <RotateCcw size={16} /> Reset
                    </button>
                    <button className="flex-[1.5] bg-[#4A6342] text-white py-3 rounded-xl flex items-center justify-center gap-1.5 font-bold text-xs hover:bg-[#3A4E34] active:scale-95 transition shadow-sm">
                        <SplitSquareHorizontal size={16} /> Tahan: Asli
                    </button>
                    </div>

                </div>
                </div>
  );
}