"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { AvatarColor } from "@/lib/social";
import { ProfileSetup } from "./profile-setup";

export function EditProfileButton({ username, emoji, color }: { username: string | null; emoji: string; color: AvatarColor }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="icon" variant="ghost" className="text-primary-foreground hover:bg-white/15" aria-label="Editar @apelido e avatar" onClick={() => setOpen(true)}><Pencil aria-hidden /></Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Seu perfil social</DialogTitle>
          <ProfileSetup initial={{ username, emoji, color }} onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
