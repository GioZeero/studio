
'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { ScrollArea } from './ui/scroll-area';
import { Skeleton } from './ui/skeleton';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, writeBatch, getDoc, runTransaction } from 'firebase/firestore';
import type { ClientData, DayOfWeek, Slot } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldCheck, ShieldX, UserCog } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';


interface SecretAdminModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onClientsUpdated: () => void;
}

export function SecretAdminModal({ isOpen, onOpenChange, onClientsUpdated }: SecretAdminModalProps) {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [clientToRename, setClientToRename] = useState<ClientData | null>(null);
  const [newName, setNewName] = useState('');
  const { toast } = useToast();

  const fetchClients = async () => {
    if (!db) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'client'));
      const querySnapshot = await getDocs(q);
      const clientList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as ClientData[];
      setClients(clientList.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error("Error fetching clients:", error);
      toast({ variant: 'destructive', title: 'Errore', description: 'Impossibile caricare i clienti.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchClients();
    }
  }, [isOpen]);

  const handleBlockToggle = async (client: ClientData) => {
    if (!db || isSaving) return;

    setIsSaving(true);
    const userRef = doc(db, 'users', client.id);
    const bankRef = doc(db, 'bank', 'total');
    const isBlocking = !client.isBlocked;

    try {
        await runTransaction(db, async (transaction) => {
            // --- 1. READS ---
            const bankSnap = await transaction.get(bankRef);
            
            const days: DayOfWeek[] = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
            const dayRefs = days.map(day => doc(db, 'schedule', day));
            const dayDocs = await Promise.all(dayRefs.map(dayRef => transaction.get(dayRef)));

            // --- 2. LOGIC ---
            let currentAmount = bankSnap.exists() ? bankSnap.data().amount : 0;
            
            if (isBlocking) {
                // Logic for BLOCKING a user
                let amountToSubtract = 0;
                if (client.subscriptionExpiry) {
                    const expiryDate = new Date(client.subscriptionExpiry);
                    const now = new Date();
                    if (expiryDate > now) {
                        const diffTime = expiryDate.getTime() - now.getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        const remainingMonths = Math.floor(diffDays / 30);
                        
                        if (remainingMonths > 0) {
                            amountToSubtract = remainingMonths * 25;
                        }
                    }
                }
                
                // --- 3. WRITES ---
                transaction.update(userRef, { isBlocked: true, subscriptionExpiry: new Date(0).toISOString() });
                if(amountToSubtract > 0) {
                    transaction.set(bankRef, { amount: currentAmount - amountToSubtract }, { merge: true });
                }

                // Remove all bookings for this user
                dayDocs.forEach(dayDoc => {
                    if (dayDoc.exists()) {
                        const data = dayDoc.data();
                        const cleanSlots = (slots: Slot[]) => slots.map(slot => ({
                            ...slot,
                            bookedBy: slot.bookedBy.filter(name => name !== client.name),
                        }));

                        const morning = cleanSlots(data.morning || []);
                        const afternoon = cleanSlots(data.afternoon || []);
                        transaction.update(dayDoc.ref, { morning, afternoon });
                    }
                });

                toast({
                    title: 'Successo!',
                    description: `${client.name} è stato bloccato. Le sue prenotazioni sono state cancellate. ${amountToSubtract > 0 ? `Rimborso di ${amountToSubtract}€ effettuato.` : ''}`,
                });

            } else {
                // Logic for UNBLOCKING a user (simulates new payment)
                const newExpiryDate = new Date();
                newExpiryDate.setMonth(newExpiryDate.getMonth() + 1, 0);
                newExpiryDate.setHours(23, 59, 59, 999);
                
                // --- 3. WRITES ---
                transaction.update(userRef, { isBlocked: false, subscriptionExpiry: newExpiryDate.toISOString() });
                transaction.set(bankRef, { amount: currentAmount + 25 }, { merge: true });

                 toast({
                    title: 'Successo!',
                    description: `${client.name} è stato sbloccato. Aggiunti 25€ alla cassa e un mese di abbonamento.`,
                });
            }
        });

        fetchClients();

    } catch (error) {
        console.error("Error toggling block status:", error);
        toast({ variant: 'destructive', title: 'Errore', description: 'Impossibile aggiornare lo stato.' });
    } finally {
        setIsSaving(false);
    }
};

  const handleRename = async () => {
    if (!db || !clientToRename || !newName.trim() || isSaving) return;

    setIsSaving(true);
    const originalName = clientToRename.id;
    const trimmedNewName = newName.trim();

    try {
      // Use a write batch for this as it's simpler than a transaction when reads aren't dependent on writes.
      const batch = writeBatch(db);
      
      const oldDocRef = doc(db, 'users', originalName);
      const newDocRef = doc(db, 'users', trimmedNewName);
      
      const newDocSnap = await getDoc(newDocRef);
      if (newDocSnap.exists()) {
        throw new Error("New name already exists.");
      }
      
      const oldClientDataSnap = await getDoc(oldDocRef);
      if (!oldClientDataSnap.exists()) {
        throw new Error("Original client not found.");
      }
      
      const clientData = { ...oldClientDataSnap.data(), name: trimmedNewName, previousName: originalName };

      batch.set(newDocRef, clientData);
      batch.delete(oldDocRef);
      
      const days: DayOfWeek[] = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
      for (const day of days) {
          const dayRef = doc(db, 'schedule', day);
          const dayDoc = await getDoc(dayRef);
          if (dayDoc.exists()) {
              const data = dayDoc.data();
              const cleanSlots = (slots: Slot[]) => slots.map(slot => ({
                  ...slot,
                  bookedBy: slot.bookedBy.filter(name => name !== originalName),
              }));

              const morning = cleanSlots(data.morning || []);
              const afternoon = cleanSlots(data.afternoon || []);
              batch.update(dayRef, { morning, afternoon });
          }
      }

      await batch.commit();

      toast({
        title: 'Successo!',
        description: `Il nome di ${originalName} è stato cambiato in ${trimmedNewName}. Le sue prenotazioni sono state cancellate. La modifica sarà applicata automaticamente al prossimo accesso del cliente.`,
      });
      onClientsUpdated(); 
      fetchClients();
      setClientToRename(null);
      setNewName('');
    } catch (error) {
      console.error("Error renaming client:", error);
      const errorMessage = (error instanceof Error && error.message.includes("New name already exists"))
        ? 'Impossibile rinominare il cliente. Il nuovo nome è già in uso.'
        : 'Errore durante la ridenominazione.';
      toast({ variant: 'destructive', title: 'Errore', description: errorMessage });
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <>
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserCog/> Pannello Amministrazione Segreto</DialogTitle>
          <DialogDescription>
            Gestisci i clienti: modifica nomi e blocca/sblocca account. Usa con cautela.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-96 border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Stato Blocco</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : clients.length > 0 ? (
                clients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium flex items-center gap-2">
                        {client.name}
                        {client.isBlocked ? <ShieldX className="h-4 w-4 text-destructive"/> : <ShieldCheck className="h-4 w-4 text-green-500" />}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={!!client.isBlocked}
                        onCheckedChange={() => handleBlockToggle(client)}
                        disabled={isSaving}
                        aria-label={`Blocca/Sblocca ${client.name}`}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" disabled={isSaving} onClick={() => {
                        setClientToRename(client);
                        setNewName(client.name);
                      }}>
                        Rinomina
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="text-center h-24 text-muted-foreground">Nessun cliente trovato.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Chiudi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog open={!!clientToRename} onOpenChange={(open) => !open && setClientToRename(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Rinomina {clientToRename?.name}</AlertDialogTitle>
                <AlertDialogDescription>
                    Inserisci il nuovo nome per il cliente. Le sue prenotazioni verranno cancellate. La modifica sarà applicata automaticamente al prossimo accesso del cliente.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
                <Label htmlFor="new-name" className="sr-only">Nuovo nome</Label>
                <Input
                    id="new-name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nuovo nome"
                    disabled={isSaving}
                />
            </div>
            <AlertDialogFooter>
                <AlertDialogCancel disabled={isSaving}>Annulla</AlertDialogCancel>
                <AlertDialogAction onClick={handleRename} disabled={isSaving || !newName.trim() || newName.trim() === clientToRename?.name}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Salva Modifiche
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
