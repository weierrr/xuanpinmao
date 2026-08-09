"use client";

import Image from "next/image";
import { MessageCircle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function ContactAuthor() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const closeOutside = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className="contact-author" ref={containerRef}>
      <button
        aria-controls="contact-author-panel"
        aria-expanded={open}
        className="contact-author-trigger"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <MessageCircle size={15} />
        联系作者
      </button>

      {open ? (
        <aside
          aria-label="联系作者微信二维码"
          className="contact-author-panel"
          id="contact-author-panel"
          role="dialog"
        >
          <div className="contact-author-head">
            <div>
              <span>WECHAT / 微信</span>
              <strong>扫码添加程桉 Wesley</strong>
            </div>
            <button aria-label="关闭二维码" onClick={() => setOpen(false)} type="button">
              <X size={17} />
            </button>
          </div>
          <div className="contact-author-image-frame">
            <Image
              alt="程桉 Wesley 的微信二维码"
              height={1268}
              src="/contact-author-wechat.jpg"
              width={818}
            />
          </div>
          <p>打开微信扫一扫，或用手机截屏后识别二维码。</p>
        </aside>
      ) : null}
    </div>
  );
}
