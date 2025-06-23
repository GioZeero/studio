'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Calendar, Clock, Plus, User, Trash2, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { AddSlotModal } from './add-slot-modal';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import type { DayOfWeek, DaySchedule, Slot } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

const initialScheduleData: DaySchedule[] = [
  { day: 'Lunedì', morning: [], afternoon: [], isOpen: false },
  { day: 'Martedì', morning: [], afternoon: [], isOpen: false },
  { day: 'Mercoledì', morning: [], afternoon: [], isOpen: false },
  { day: 'Giovedì', morning: [], afternoon: [], isOpen: false },
  { day: 'Venerdì', morning: [], afternoon: [], isOpen: false },
  { day: 'Sabato', morning: [], afternoon: [], isOpen: false },
  { day: 'Domenica', morning: [], afternoon: [], isOpen: false },
];

export default function AgendaView({ user }: { user: { role: 'owner' | 'client'; name: string } }) {
  const [schedule, setSchedule] = useState<DaySchedule[]>(initialScheduleData);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (user.role === 'owner') {
      toast({
        title: `Benvenuto, ${user.name}!`,
        description: "Ricordati di aggiungere gli orari della palestra per la settimana.",
      });
    }
  }, [user.name, user.role, toast]);

  const handleAddSlot = (day: DayOfWeek, period: 'morning' | 'afternoon', timeRange: string) => {
    setSchedule(currentSchedule =>
      currentSchedule.map(d => {
        if (d.day === day) {
          const newSlot: Slot = { id: `${day}-${period}-${Date.now()}`, timeRange, bookedBy: null };
          const updatedPeriodSlots = [...d[period], newSlot].sort((a,b) => a.timeRange.localeCompare(b.timeRange));
          return { ...d, isOpen: true, [period]: updatedPeriodSlots };
        }
        return d;
      })
    );
    toast({ title: "Orario Aggiunto!", description: `Il nuovo orario per ${day} ${period} è stato aggiunto.` });
  };

  const handleBookSlot = (slot: Slot) => {
    setSchedule(currentSchedule =>
      currentSchedule.map(day => ({
        ...day,
        morning: day.morning.map(s => (s.id === slot.id ? { ...s, bookedBy: user.name } : s)),
        afternoon: day.afternoon.map(s => (s.id === slot.id ? { ...s, bookedBy: user.name } : s)),
      }))
    );
    toast({
      title: 'Prenotazione Confermata!',
      description: `${user.name}, il tuo orario è stato prenotato. Il proprietario è stato avvisato.`,
    });
  };

  const handleResetWeek = () => {
    setSchedule(initialScheduleData);
    toast({
      title: 'Orari Azzerati',
      description: 'Tutti gli orari della settimana sono stati cancellati.',
      variant: 'destructive',
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-body">
      {user.role === 'owner' && <AddSlotModal isOpen={isModalOpen} onOpenChange={setIsModalOpen} onAddSlot={handleAddSlot} />}
      
      <header className="p-4 md:p-6 flex justify-between items-center border-b sticky top-0 bg-background/80 backdrop-blur-sm z-10">
        <Link href="/" className="text-2xl font-bold font-headline text-primary">GymAgenda</Link>
        <div className="flex items-center gap-2 md:gap-4">
          <div className="text-right hidden md:block">
            <p className="font-semibold">{user.name}</p>
            <p className="text-sm text-muted-foreground capitalize">{user.role}</p>
          </div>
          {user.role === 'owner' ? (
            <>
              <Button onClick={() => setIsModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Aggiungi Orari
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                   <Button variant="destructive" size="icon" aria-label="Azzera settimana">
                    <Trash2 className="h-4 w-4" />
                   </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
                    <AlertDialogDescription>Questa azione non può essere annullata. Questo azzererà tutti gli orari per la settimana.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                    <AlertDialogAction onClick={handleResetWeek}>Continua</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : (
            <div className="flex items-center gap-2 rounded-full border p-2 bg-card">
              <User className="h-4 w-4 text-primary" />
              <span className="font-semibold">{user.name}</span>
            </div>
          )}
        </div>
      </header>

      <main className="p-4 md:p-6 lg:p-8">
        <div className="space-y-6">
          {schedule.map(daySchedule => {
            const hasSlots = daySchedule.morning.length > 0 || daySchedule.afternoon.length > 0;
            if (user.role === 'client' && !hasSlots) return null;

            return (
              <Card key={daySchedule.day} className={`transition-all ${!hasSlots ? 'opacity-60 bg-muted/30' : 'shadow-lg border-primary/20'}`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-2xl font-headline">
                    <Calendar className="h-6 w-6 text-primary" />
                    {daySchedule.day}
                  </CardTitle>
                  {!hasSlots && <CardDescription>Nessun orario disponibile per questo giorno.</CardDescription>}
                </CardHeader>
                {hasSlots && (
                  <CardContent className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <h3 className="font-semibold text-lg flex items-center gap-2"><Sun className="text-accent" /> Mattina</h3>
                      <div className="flex flex-wrap gap-2">
                        {daySchedule.morning.length > 0 ? daySchedule.morning.map(slot => (
                          user.role === 'client' ? (
                            <Button key={slot.id} variant={slot.bookedBy ? "secondary" : "default"} onClick={() => handleBookSlot(slot)} disabled={!!slot.bookedBy} className="flex-grow transition-all duration-300">
                              <Clock className="mr-2 h-4 w-4" />
                              {slot.timeRange}
                              {slot.bookedBy && <span className="ml-2 font-normal opacity-80">- Prenotato da {slot.bookedBy === user.name ? 'te' : slot.bookedBy}</span>}
                            </Button>
                          ) : (
                            <Badge key={slot.id} variant={slot.bookedBy ? "secondary" : "default"} className="p-2 text-sm">
                              {slot.timeRange} {slot.bookedBy && `(Prenotato: ${slot.bookedBy})`}
                            </Badge>
                          )
                        )) : <p className="text-sm text-muted-foreground">Nessun orario per la mattina.</p>}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <h3 className="font-semibold text-lg flex items-center gap-2"><Moon className="text-blue-400" /> Pomeriggio</h3>
                      <div className="flex flex-wrap gap-2">
                        {daySchedule.afternoon.length > 0 ? daySchedule.afternoon.map(slot => (
                          user.role === 'client' ? (
                            <Button key={slot.id} variant={slot.bookedBy ? "secondary" : "default"} onClick={() => handleBookSlot(slot)} disabled={!!slot.bookedBy} className="flex-grow transition-all duration-300">
                              <Clock className="mr-2 h-4 w-4" />
                              {slot.timeRange}
                              {slot.bookedBy && <span className="ml-2 font-normal opacity-80">- Prenotato da {slot.bookedBy === user.name ? 'te' : slot.bookedBy}</span>}
                            </Button>
                          ) : (
                             <Badge key={slot.id} variant={slot.bookedBy ? "secondary" : "default"} className="p-2 text-sm">
                              {slot.timeRange} {slot.bookedBy && `(Prenotato: ${slot.bookedBy})`}
                            </Badge>
                          )
                        )) : <p className="text-sm text-muted-foreground">Nessun orario per il pomeriggio.</p>}
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
