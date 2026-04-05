"use client";

import { useState } from "react";
import { MessageCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";

const COUNSELLOR_PHONE = process.env.NEXT_PUBLIC_COUNSELLOR_WHATSAPP_NUMBER || "";

// Pre-filled message that triggers the scheduling bot
const WA_TEXT = encodeURIComponent("Hi! I'd like to schedule a 1:1 counselling session.");

const WA_LINK = COUNSELLOR_PHONE
  ? `https://wa.me/${COUNSELLOR_PHONE}?text=${WA_TEXT}`
  : `https://wa.me/?text=${WA_TEXT}`;

// QR code via qrserver.com (free, no API key needed)
const QR_URL = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(WA_LINK)}`;

export default function WhatsAppScheduleCard() {
  const [qrLoaded, setQrLoaded] = useState(false);
  const [qrError, setQrError] = useState(false);

  return (
    <Card className="border-border/40 bg-linear-to-b from-emerald-50/60 to-card/90 dark:from-emerald-950/20 dark:to-card/90 backdrop-blur-sm">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-5">
          <MessageCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span className="text-sm font-bold text-muted-foreground">Book a 1:1 Session via WhatsApp</span>
        </div>

        <div className="flex flex-col items-center gap-5">
          {/* QR Code */}
          <div className="relative flex items-center justify-center rounded-2xl bg-white p-3 shadow-md ring-1 ring-border/30">
            {!qrLoaded && !qrError && (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
              </div>
            )}
            {qrError ? (
              <div className="flex h-[160px] w-[160px] items-center justify-center rounded-lg bg-gray-50 text-center text-xs text-muted-foreground p-4">
                QR failed to load.<br />Use the button below.
              </div>
            ) : (
              <Image
                src={QR_URL}
                alt="Scan to book counselling on WhatsApp"
                width={160}
                height={160}
                className={`rounded-lg transition-opacity duration-300 ${qrLoaded ? "opacity-100" : "opacity-0"}`}
                onLoad={() => setQrLoaded(true)}
                onError={() => setQrError(true)}
                unoptimized
              />
            )}
          </div>

          {/* WhatsApp icon watermark */}
          <div className="flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-emerald-500" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            <span className="text-xs text-muted-foreground font-medium">WhatsApp</span>
          </div>

          {/* Description */}
          <div className="text-center">
            <p className="text-sm font-bold text-foreground">Scan to chat with your counsellor</p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Opens WhatsApp with a pre-filled message. The counsellor will help you schedule a personalised 1:1 session.
            </p>
          </div>

          {/* Fallback button for mobile */}
          <Button
            asChild
            size="sm"
            className="w-full gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold"
          >
            <a href={WA_LINK} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" />
              Open in WhatsApp
              <ExternalLink className="h-3 w-3 opacity-70" />
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
