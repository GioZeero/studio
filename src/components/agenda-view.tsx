
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Calendar, Plus, User, Trash2, Sun, Moon, LogOut, Loader2, List, FileText, Bell, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AddSlotModal } from './add-slot-modal';
import { DeleteSlotModal, type SlotToDelete } from './delete-slot-modal';
import type { DayOfWeek, DaySchedule, Slot, User as AppUser } from '@/lib/types';
import { collection, doc, onSnapshot, writeBatch, runTransaction, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Skeleton } from './ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuPortal, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ExpiryReminderModal } from './expiry-reminder-modal';
import { SubscriptionModal } from './subscription-modal';
import { ClientListModal } from './client-list-modal';
import { isPast } from 'date-fns';
import { NotificationsModal } from './notifications-modal';
import { BookingConfirmationModal } from './booking-confirmation-modal';
import { ExpensesModal } from './expenses-modal';

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

export default function AgendaView() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [schedule, setSchedule] = useState<DaySchedule[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isAddSlotModalOpen, setAddSlotModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSubscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [isClientListModalOpen, setClientListModalOpen] = useState(false);
  const [isExpiryReminderOpen, setExpiryReminderOpen] = useState(false);
  const [isNotificationsModalOpen, setNotificationsModalOpen] = useState(false);
  const [isBookingModalOpen, setBookingModalOpen] = useState(false);
  const [isExpensesModalOpen, setExpensesModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  const [modalPeriod, setModalPeriod] = useState<'morning' | 'afternoon'>('morning');
  const [bookingSlotId, setBookingSlotId] = useState<string | null>(null);
  const [currentDay, setCurrentDay] = useState<DayOfWeek | null>(null);
  const [dateRange, setDateRange] = useState('');
  const router = useRouter();
  const { setTheme } = useTheme();
  
  useEffect(() => {
    const dayNames: DayOfWeek[] = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
    const todayIndex = new Date().getDay();
    setCurrentDay(dayNames[todayIndex]);
    
    const getWeekRange = () => {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        
        const monday = new Date(now);
        monday.setDate(now.getDate() + diffToMonday);

        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);

        const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'long' };
        const mondayFormatted = monday.toLocaleDateString('it-IT', options);
        const sundayFormatted = sunday.toLocaleDateString('it-IT', options);

        return `Settimana dal ${mondayFormatted} al ${sundayFormatted}`;
    };
    setDateRange(getWeekRange());
  }, []);

  useEffect(() => {
    const storedUser = localStorage.getItem('gymUser');
    if (!storedUser) {
      router.replace('/');
      return;
    }

    const fetchUserData = async (name: string, role: 'owner' | 'client') => {
      if (!db) {
        setUser({ name, role });
        setCheckingAuth(false);
        return;
      }
      const userRef = doc(db, 'users', name);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data() as AppUser;
        setUser(userData);
        if (userData.role === 'client') {
          const isExpired = !userData.subscriptionExpiry || isPast(new Date(userData.subscriptionExpiry));
          if (isExpired) {
            setExpiryReminderOpen(true);
          }
        }
      } else {
        try {
          console.warn(`User '${name}' found in localStorage but not in Firestore. Re-creating user.`);
          const newUser: Omit<AppUser, 'id'> = { name, role };
          await setDoc(userRef, newUser);
          setUser(newUser as AppUser);
        } catch (e) {
          console.error("Failed to re-create user in Firestore. Logging out.", e);
          localStorage.removeItem('gymUser');
          router.replace('/');
        }
      }
      setCheckingAuth(false);
    };

    try {
      const { name, role } = JSON.parse(storedUser);
      fetchUserData(name, role);
    } catch (e) {
      localStorage.removeItem('gymUser');
      router.replace('/');
    }
  }, [router]);

  useEffect(() => {
    if (!user) return;

    const performWeeklyReset = async () => {
      if (user.role !== 'owner' || !db) return;

      const getWeekIdForDate = (date: Date): string => {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const weekNumber = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        return `${d.getUTCFullYear()}-W${weekNumber}`;
      };

      const currentWeekId = getWeekIdForDate(new Date());
      const metaRef = doc(db, 'app_meta', 'schedule_state');

      try {
        await runTransaction(db, async (transaction) => {
          // 1. First, read the meta document to check the last reset week.
          const metaDoc = await transaction.get(metaRef);
          const lastResetWeekId = metaDoc.exists() ? metaDoc.data().lastResetWeekId : null;

          if (currentWeekId !== lastResetWeekId) {
            console.log(`New week detected (current: ${currentWeekId}, last: ${lastResetWeekId}). Performing weekly schedule reset.`);
            
            const days: DayOfWeek[] = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
            const dayRefs = days.map(day => doc(db, 'schedule', day));
            
            // 2. Perform all reads for the schedule documents.
            const dayDocs = await Promise.all(dayRefs.map(ref => transaction.get(ref)));

            // 3. Now, perform all write operations.
            for (const dayDoc of dayDocs) {
              if (dayDoc.exists()) {
                transaction.update(dayDoc.ref, { morning: [], afternoon: [], isOpen: false });
              }
            }

            transaction.set(metaRef, { lastResetWeekId: currentWeekId });
            console.log(`Weekly reset successful. New week ID: ${currentWeekId}`);
          }
        });
      } catch (error) {
        console.error("Error during weekly reset transaction:", error);
      }
    };
    
    setLoading(true);
    performWeeklyReset().finally(() => {
        if (!db) {
            console.warn("Il database Firestore non è disponibile.");
            setSchedule(initialScheduleData);
            setLoading(false);
            return;
        }

        const scheduleCol = collection(db, 'schedule');
        
        const unsubscribe = onSnapshot(scheduleCol, (querySnapshot) => {
            if (querySnapshot.empty) {
              const setupInitialSchedule = async () => {
                if (!db) return;
                const batch = writeBatch(db);
                initialScheduleData.forEach(daySchedule => {
                  const { day, ...dataToSet } = daySchedule;
                  const dayRef = doc(db, 'schedule', day);
                  batch.set(dayRef, dataToSet);
                });
                await batch.commit();
              };
              setupInitialSchedule();
              setSchedule(initialScheduleData);
            } else {
              const scheduleData = querySnapshot.docs.map(docSnapshot => {
                const data = docSnapshot.data();
                const transformSlot = (slot: any): Slot => ({
                  ...slot,
                  bookedBy: Array.isArray(slot.bookedBy) ? slot.bookedBy : [],
                });

                return {
                  day: docSnapshot.id as DayOfWeek,
                  morning: (data.morning || []).map(transformSlot),
                  afternoon: (data.afternoon || []).map(transformSlot),
                  isOpen: data.isOpen || false,
                };
              });
              
              const dayOrder: DayOfWeek[] = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
              scheduleData.sort((a, b) => dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day));
              
              setSchedule(scheduleData as DaySchedule[]);
            }
            setLoading(false);
        }, (error) => {
            console.error("Errore con il listener in tempo reale della pianificazione: ", error);
            setSchedule(initialScheduleData);
            setLoading(false);
        });

        return () => unsubscribe();
    });

  }, [user]);

  const handleLogout = () => {
    localStorage.removeItem('gymUser');
    router.push('/');
  };

  const handleSubscriptionUpdate = (newExpiry: string) => {
    if (user) {
      setUser({ ...user, subscriptionExpiry: newExpiry });
    }
  };

  const handleAddSlot = async (day: DayOfWeek, period: 'morning' | 'afternoon', timeRange: string) => {
    if (!db || !user) return;
    const dayRef = doc(db, 'schedule', day);

    try {
        await runTransaction(db, async (transaction) => {
            const dayDoc = await transaction.get(dayRef);
            if (!dayDoc.exists()) {
                throw new Error(`Documento per ${day} non esiste.`);
            }

            const data = dayDoc.data();
            const currentPeriodSlots: Slot[] = data[period] || [];
            
            const newSlot: Slot = { id: `${day}-${period}-${Date.now()}`, timeRange, bookedBy: [], createdBy: user.name };
            
            const updatedPeriodSlots = [...currentPeriodSlots, newSlot].sort((a,b) => a.timeRange.localeCompare(b.timeRange));

            transaction.update(dayRef, { [period]: updatedPeriodSlots, isOpen: true });
        });
    } catch (error) {
        console.error("Errore nell'aggiungere l'orario: ", error);
    }
  };

  const handleBookSlot = async (slotToBook: Slot) => {
    if (!db || !user || bookingSlotId) return;
    
    setBookingSlotId(slotToBook.id);

    const dayOfWeek = schedule.find(day => 
        day.morning.some(s => s.id === slotToBook.id) || 
        day.afternoon.some(s => s.id === slotToBook.id)
    )?.day;

    if (!dayOfWeek) {
        setBookingSlotId(null);
        setBookingModalOpen(false);
        return;
    }

    const dayRef = doc(db, 'schedule', dayOfWeek);

    try {
        await runTransaction(db, async (transaction) => {
            const dayDoc = await transaction.get(dayRef);
            if (!dayDoc.exists()) {
                throw "Il documento non esiste!";
            }

            let wasBookingAction = false;
            const data = dayDoc.data();

            const updateSlots = (slots: Slot[]): Slot[] => {
                return slots.map(s => {
                    if (s.id === slotToBook.id) {
                        const isBookedByUser = s.bookedBy.includes(user.name);
                        wasBookingAction = !isBookedByUser;
                        const newBookedBy = isBookedByUser
                            ? s.bookedBy.filter(name => name !== user.name)
                            : [...s.bookedBy, user.name].sort();
                        return { ...s, bookedBy: newBookedBy };
                    }
                    return s;
                });
            };
            
            const updatedMorning = updateSlots(data.morning || []);
            const updatedAfternoon = updateSlots(data.afternoon || []);
            
            transaction.update(dayRef, { morning: updatedMorning, afternoon: updatedAfternoon });
            
            return wasBookingAction;
        });
    } catch (error) {
        console.error("Errore nella transazione di prenotazione: ", error);
    } finally {
        setBookingSlotId(null);
        setBookingModalOpen(false);
    }
  };

  const handleDeleteSlots = async (slotsToDelete: SlotToDelete[]) => {
    if (!db || slotsToDelete.length === 0) return;

    const slotsByDay = slotsToDelete.reduce((acc, slot) => {
      const day = slot.day as DayOfWeek;
      if (!acc[day]) {
        acc[day] = [];
      }
      acc[day].push(slot);
      return acc;
    }, {} as Record<DayOfWeek, SlotToDelete[]>);

    try {
      await runTransaction(db, async (transaction) => {
        const dayDocs = await Promise.all(
          Object.keys(slotsByDay).map(day => transaction.get(doc(db, 'schedule', day as DayOfWeek)))
        );

        const dayDocsMap = new Map(dayDocs.map(d => [d.id, d]));

        for (const day of Object.keys(slotsByDay) as DayOfWeek[]) {
          const dayRef = doc(db, 'schedule', day);
          const dayDoc = dayDocsMap.get(day);

          if (!dayDoc || !dayDoc.exists()) continue;

          const data = dayDoc.data();
          let morningSlots: Slot[] = data.morning || [];
          let afternoonSlots: Slot[] = data.afternoon || [];

          const slotsForThisDay = slotsByDay[day];
          const morningIdsToDelete = new Set(slotsForThisDay.filter(s => s.period === 'morning').map(s => s.slotId));
          const afternoonIdsToDelete = new Set(slotsForThisDay.filter(s => s.period === 'afternoon').map(s => s.slotId));

          const updatedMorningSlots = morningSlots.filter(s => !morningIdsToDelete.has(s.id));
          const updatedAfternoonSlots = afternoonSlots.filter(s => !afternoonIdsToDelete.has(s.id));

          const dayIsOpen = updatedMorningSlots.length > 0 || updatedAfternoonSlots.length > 0;

          transaction.update(dayRef, {
            morning: updatedMorningSlots,
            afternoon: updatedAfternoonSlots,
            isOpen: dayIsOpen
          });
        }
      });
    } catch (error) {
      console.error("Errore nella cancellazione multipla: ", error);
    }
  };


  if (checkingAuth || !user) {
    return (
      <div className="min-h-screen bg-background">
        <header className="p-4 md:p-6 flex justify-between items-center border-b sticky top-0 bg-background/80 backdrop-blur-sm z-10">
          <Skeleton className="h-7 w-32" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-10" />
          </div>
        </header>
        <main className="p-4 md:p-6 lg:p-8">
          <AgendaViewLoader />
        </main>
      </div>
    );
  }

  const renderSlot = (slot: Slot) => {
    if (user.role === 'owner') {
      const attendees = [
        ...(slot.createdBy ? [slot.createdBy] : []),
        ...slot.bookedBy,
      ];
      const uniqueAttendees = [...new Set(attendees)];

      return (
        <Popover key={slot.id}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                'group relative flex h-auto min-w-[120px] flex-grow flex-col items-start rounded-md border p-2 text-left transition-colors',
                slot.bookedBy.length > 0 ? 'bg-muted/50' : 'bg-transparent',
                'hover:bg-accent/50'
              )}
            >
              <p className="font-semibold text-sm">{slot.timeRange}</p>
              <p className="text-xs text-muted-foreground">
                {slot.bookedBy.length > 0 ? `${slot.bookedBy.length} prenotati` : 'Libero'}
              </p>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-4">
            <div className="space-y-2 text-sm">
                <p className="font-semibold text-base mb-2">Persone presenti</p>
                {uniqueAttendees.length > 0 ? (
                    <div className="max-h-32 overflow-y-auto pr-2">
                        <ul className="list-disc list-inside space-y-1.5">
                            {uniqueAttendees.map((name, index) => <li key={index}>{name}</li>)}
                        </ul>
                    </div>
                ) : (
                    <p className="text-muted-foreground">Nessuna persona prenotata.</p>
                )}
            </div>
          </PopoverContent>
        </Popover>
      );
    }

    const isBookedByUser = slot.bookedBy.includes(user.name);
    const isProcessing = bookingSlotId === slot.id;

    return (
        <button
            key={slot.id}
            disabled={!!bookingSlotId}
            onClick={() => {
                setSelectedSlot(slot);
                setBookingModalOpen(true);
            }}
            className={cn(
                "group relative flex h-auto min-w-[120px] flex-grow flex-col items-start rounded-md border p-2 text-left transition-all disabled:opacity-50",
                isBookedByUser 
                    ? "border-primary bg-primary/10" 
                    : "border-border bg-transparent hover:bg-accent/50",
                isProcessing && "animate-pulse"
            )}
        >
            {isProcessing && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="h-4 w-4 animate-spin"/></div>}
            <p className="font-semibold text-sm">{slot.timeRange}</p>
            <p className="text-xs text-muted-foreground">
              {slot.bookedBy.length} prenotati
            </p>
            {isBookedByUser && !isProcessing && (
              <div className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
            )}
        </button>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-body">
      {user && (
        <>
            {user.role === 'owner' && (
                <>
                    <AddSlotModal isOpen={isAddSlotModalOpen} onOpenChange={setAddSlotModalOpen} onAddSlot={handleAddSlot} period={modalPeriod} onPeriodChange={setModalPeriod} />
                    <DeleteSlotModal isOpen={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen} schedule={schedule} onDeleteSlots={handleDeleteSlots} />
                    <ClientListModal isOpen={isClientListModalOpen} onOpenChange={setClientListModalOpen} />
                    <NotificationsModal isOpen={isNotificationsModalOpen} onOpenChange={setNotificationsModalOpen} />
                </>
            )}
            {user.role === 'client' && (
                <>
                    <ExpiryReminderModal isOpen={isExpiryReminderOpen} onOpenChange={setExpiryReminderOpen} user={user} onSubscriptionUpdate={handleSubscriptionUpdate} />
                    <SubscriptionModal isOpen={isSubscriptionModalOpen} onOpenChange={setSubscriptionModalOpen} user={user} onSubscriptionUpdate={handleSubscriptionUpdate} />
                </>
            )}
            <BookingConfirmationModal
                isOpen={isBookingModalOpen}
                onOpenChange={setBookingModalOpen}
                slot={selectedSlot}
                user={user}
                onConfirm={handleBookSlot}
                isLoading={!!bookingSlotId}
            />
            <ExpensesModal isOpen={isExpensesModalOpen} onOpenChange={setExpensesModalOpen} user={user} />
        </>
      )}
      
      <header className="p-4 md:p-6 flex justify-between items-center border-b sticky top-0 bg-background/80 backdrop-blur-sm z-10">
        <Link href="/" className="text-2xl font-bold font-headline text-primary">GymAgenda</Link>
        <div className="flex items-center gap-2 md:gap-4">
          {user.role === 'owner' && (
            <>
              <Button onClick={() => setAddSlotModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Aggiungi Orari
              </Button>
              <Button variant="destructive" size="icon" aria-label="Cancella orario" onClick={() => setIsDeleteModalOpen(true)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
                {user.role === 'owner' ? (
                    <Button variant="ghost" className="flex items-center gap-3 p-1 rounded-full h-auto">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                            <User className="h-5 w-5" />
                        </div>
                        <div className="text-left hidden md:block pr-2">
                            <p className="font-semibold text-sm leading-tight">{user.name}</p>
                            <p className="text-xs text-muted-foreground capitalize leading-tight">{user.role}</p>
                        </div>
                    </Button>
                ) : (
                    <Button variant="outline" className="flex items-center gap-2 rounded-full p-1 pr-3 h-auto">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                            <User className="h-5 w-5 text-primary" />
                        </div>
                        <span className="font-semibold">{user.name}</span>
                    </Button>
                )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Il Mio Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                {user.role === 'client' && (
                    <DropdownMenuItem onClick={() => setSubscriptionModalOpen(true)}>
                        <FileText className="mr-2 h-4 w-4" />
                        <span>Abbonamento</span>
                    </DropdownMenuItem>
                )}
                {user.role === 'owner' && (
                  <>
                    <DropdownMenuItem onClick={() => setClientListModalOpen(true)}>
                        <List className="mr-2 h-4 w-4" />
                        <span>Clienti e Banca</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setNotificationsModalOpen(true)}>
                        <Bell className="mr-2 h-4 w-4" />
                        <span>Notifiche</span>
                    </DropdownMenuItem>
                  </>
                )}

                <DropdownMenuItem onClick={() => setExpensesModalOpen(true)}>
                    <Receipt className="mr-2 h-4 w-4" />
                    <span>Spese</span>
                </DropdownMenuItem>
                
                <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                        <Sun className="mr-2 h-4 w-4" />
                        <span>Tema</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                            <DropdownMenuItem onClick={() => setTheme('light')}>Chiaro</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setTheme('dark')}>Scuro</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setTheme('system')}>Sistema</DropdownMenuItem>
                        </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Esci</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="p-4 md:p-6 lg:p-8">
        <div className="mb-2">
            <h2 className="text-sm font-semibold text-muted-foreground tracking-wider">{dateRange}</h2>
        </div>
        { loading ? <AgendaViewLoader /> : (
          <div className="space-y-6">
            {schedule.map(daySchedule => {
              const hasSlots = daySchedule.morning.length > 0 || daySchedule.afternoon.length > 0;
              if (user.role === 'client' && !hasSlots) return null;

              return (
                <Card 
                  key={daySchedule.day} 
                  className={cn('transition-all duration-300', {
                    'border-2 border-accent shadow-xl shadow-accent/20': daySchedule.day === currentDay,
                    'opacity-60 bg-muted/30': daySchedule.day !== currentDay && !hasSlots,
                    'shadow-lg border-primary/20': daySchedule.day !== currentDay && hasSlots,
                  })}
                >
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
                          {daySchedule.morning.length > 0 ? daySchedule.morning.map(renderSlot) : <p className="text-sm text-muted-foreground">Nessun orario per la mattina.</p>}
                        </div>
                      </div>
                      <div className="space-y-3">
                        <h3 className="font-semibold text-lg flex items-center gap-2"><Moon className="text-primary" /> Pomeriggio</h3>
                        <div className="flex flex-wrap gap-2">
                          {daySchedule.afternoon.length > 0 ? daySchedule.afternoon.map(renderSlot) : <p className="text-sm text-muted-foreground">Nessun orario per il pomeriggio.</p>}
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
