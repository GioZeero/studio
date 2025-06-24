'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Calendar, Clock, Plus, User, Trash2, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { AddSlotModal } from './add-slot-modal';
import { DeleteSlotModal } from './delete-slot-modal';
import type { DayOfWeek, DaySchedule, Slot } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { collection, doc, getDocs, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Skeleton } from './ui/skeleton';
import { ThemeToggle } from './theme-toggle';

const initialScheduleData: DaySchedule[] = [
  { day: 'Lunedì', morning: [], afternoon: [], isOpen: false },
  { day: 'Martedì', morning: [], afternoon: [], isOpen: false },
  { day: 'Mercoledì', morning: [], afternoon: [], isOpen: false },
  { day: 'Giovedì', morning: [], afternoon: [], isOpen: false },
  { day: 'Venerdì', morning: [], afternoon: [], isOpen: false },
  { day: 'Sabato', morning: [], afternoon: [], isOpen: false },
  { day: 'Domenica', morning: [], afternoon: [], isOpen: false },
];

function AgendaViewLoader() {
  return (
    <div className="space-y-6">
      {[...Array(3)].map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-8 w-1/3" />
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Skeleton className="h-6 w-1/4 mb-2" />
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-10 w-40" />
                <Skeleton className="h-10 w-40" />
              </div>
            </div>
            <div className="space-y-3">
              <Skeleton className="h-6 w-1/4 mb-2" />
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-10 w-40" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default function AgendaView({ user }: { user: { role: 'owner' | 'client'; name: string } }) {
  const [schedule, setSchedule] = useState<DaySchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [modalPeriod, setModalPeriod] = useState<'morning' | 'afternoon'>('morning');
  const { toast } = useToast();

  useEffect(() => {
    if (user.role === 'owner') {
      toast({
        title: `Benvenuto, ${user.name}!`,
        description: "Ricordati di aggiungere gli orari della palestra per la settimana.",
      });
    }
  }, [user.name, user.role, toast]);

  useEffect(() => {
    const fetchSchedule = async () => {
      setLoading(true);
      if (!db) {
        toast({
          title: "Configurazione Firebase Mancante",
          description: "Le credenziali Firebase non sono state impostate o non sono valide. Controlla il file .env.local e riavvia il server.",
          variant: "destructive",
        });
        setSchedule(initialScheduleData);
        setLoading(false);
        return;
      }
      try {
        const scheduleCol = collection(db, 'schedule');
        const scheduleSnapshot = await getDocs(scheduleCol);
        if (scheduleSnapshot.empty) {
          const batch = writeBatch(db);
          initialScheduleData.forEach(daySchedule => {
            const { day, ...dataToSet } = daySchedule;
            const dayRef = doc(db, 'schedule', day);
            batch.set(dayRef, dataToSet);
          });
          await batch.commit();
          setSchedule(initialScheduleData);
        } else {
          const scheduleData = scheduleSnapshot.docs.map(doc => ({
            day: doc.id as DayOfWeek,
            ...(doc.data() as Omit<DaySchedule, 'day'>),
          }));
          
          const dayOrder: DayOfWeek[] = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
          scheduleData.sort((a, b) => dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day));
          
          setSchedule(scheduleData as DaySchedule[]);
        }
      } catch (error) {
        console.error("Error fetching schedule: ", error);
        toast({ title: "Errore di caricamento", description: "Impossibile caricare gli orari. Verifica la connessione e le regole di sicurezza di Firestore.", variant: "destructive" });
        setSchedule(initialScheduleData);
      } finally {
        setLoading(false);
      }
    };

    fetchSchedule();
  }, [toast]);

  const handleAddSlot = async (day: DayOfWeek, period: 'morning' | 'afternoon', timeRange: string) => {
    if (!db) {
      toast({ title: "Errore", description: "Firebase non è configurato.", variant: "destructive" });
      return;
    }
    const originalSchedule = [...schedule];
    const dayRef = doc(db, 'schedule', day);
    const dayData = schedule.find(d => d.day === day);
    if (!dayData) return;

    const newSlot: Slot = { id: `${day}-${period}-${Date.now()}`, timeRange, bookedBy: null };
    const updatedPeriodSlots = [...dayData[period], newSlot].sort((a,b) => a.timeRange.localeCompare(b.timeRange));
    
    const updatedDay = { ...dayData, [period]: updatedPeriodSlots, isOpen: true };
    
    setSchedule(currentSchedule => currentSchedule.map(d => (d.day === day ? updatedDay : d)));

    try {
        await updateDoc(dayRef, { [period]: updatedPeriodSlots, isOpen: true });
        toast({ title: "Orario Aggiunto!", description: `Il nuovo orario per ${day} è stato aggiunto.` });
    } catch (error) {
        console.error("Error adding slot: ", error);
        toast({ title: "Errore", description: "Impossibile aggiungere l'orario.", variant: "destructive" });
        setSchedule(originalSchedule);
    }
  };

  const handleBookSlot = async (slotToBook: Slot) => {
    if (!db) {
      toast({ title: "Errore", description: "Firebase non è configurato.", variant: "destructive" });
      return;
    }
    const originalSchedule = [...schedule];
    const dayOfWeek = schedule.find(day => day.morning.some(s => s.id === slotToBook.id) || day.afternoon.some(s => s.id === slotToBook.id))?.day;

    if (!dayOfWeek) return;

    const dayRef = doc(db, 'schedule', dayOfWeek);
    const dayData = schedule.find(d => d.day === dayOfWeek);
    if (!dayData) return;

    const updateSlots = (slots: Slot[]) => slots.map(s => s.id === slotToBook.id ? { ...s, bookedBy: user.name } : s);
    const updatedMorning = updateSlots(dayData.morning);
    const updatedAfternoon = updateSlots(dayData.afternoon);
    
    setSchedule(currentSchedule => currentSchedule.map(d => d.day === dayOfWeek ? {...d, morning: updatedMorning, afternoon: updatedAfternoon} : d));

    try {
        await updateDoc(dayRef, { morning: updatedMorning, afternoon: updatedAfternoon });
        toast({
          title: 'Prenotazione Confermata!',
          description: `${user.name}, il tuo orario è stato prenotato.`,
        });
    } catch (error) {
        console.error("Error booking slot: ", error);
        toast({ title: "Errore", description: "Impossibile prenotare l'orario.", variant: "destructive" });
        setSchedule(originalSchedule);
    }
  };

  const handleDeleteSlot = async (day: DayOfWeek, period: 'morning' | 'afternoon', slotId: string) => {
    if (!db) {
      toast({ title: "Errore", description: "Firebase non è configurato.", variant: "destructive" });
      return;
    }
    const originalSchedule = JSON.parse(JSON.stringify(schedule));
    const dayRef = doc(db, 'schedule', day);
    const dayData = schedule.find(d => d.day === day);
    if (!dayData) return;

    const updatedPeriodSlots = dayData[period].filter(slot => slot.id !== slotId);
    
    const otherPeriod = period === 'morning' ? 'afternoon' : 'morning';
    const dayIsOpen = updatedPeriodSlots.length > 0 || dayData[otherPeriod].length > 0;

    const updatedDay = { ...dayData, [period]: updatedPeriodSlots, isOpen: dayIsOpen };
    
    setSchedule(currentSchedule => currentSchedule.map(d => (d.day === day ? updatedDay : d)));

    try {
        await updateDoc(dayRef, { [period]: updatedPeriodSlots, isOpen: dayIsOpen });
        toast({ title: "Orario Cancellato!", description: `L'orario è stato rimosso.` });
        setIsDeleteModalOpen(false);
    } catch (error) {
        console.error("Error deleting slot: ", error);
        toast({ title: "Errore", description: "Impossibile cancellare l'orario.", variant: "destructive" });
        setSchedule(originalSchedule);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-body">
      {user.role === 'owner' && (
        <>
          <AddSlotModal isOpen={isModalOpen} onOpenChange={setIsModalOpen} onAddSlot={handleAddSlot} period={modalPeriod} onPeriodChange={setModalPeriod} />
          <DeleteSlotModal isOpen={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen} schedule={schedule} onDeleteSlot={handleDeleteSlot} />
        </>
      )}
      
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
              <Button variant="destructive" size="icon" aria-label="Cancella orario" onClick={() => setIsDeleteModalOpen(true)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-2 rounded-full border p-2 bg-card">
              <User className="h-4 w-4 text-primary" />
              <span className="font-semibold">{user.name}</span>
            </div>
          )}
          <ThemeToggle />
        </div>
      </header>

      <main className="p-4 md:p-6 lg:p-8">
        { loading ? <AgendaViewLoader /> : (
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
        )}
      </main>
    </div>
  );
}
