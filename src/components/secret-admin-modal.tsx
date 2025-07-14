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
import { collection, query, where, getDocs, doc, writeBatch, updateDoc, getDoc } from 'firebase/firestore';
import type { ClientData } from '@/lib/types';
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
    try {
      const userRef = doc(db, 'users', client.id);
      await updateDoc(userRef, { isBlocked: !client.isBlocked });
      setClients(clients.map(c => c.id === client.id ? { ...c, isBlocked: !c.isBlocked } : c));
      toast({
        title: 'Successo!',
        description: `${client.name} è stato ${!client.isBlocked ? 'bloccato' : 'sbloccato'}.`,
      });
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
      const oldDocRef = doc(db, 'users', originalName);
      const newDocRef = doc(db, 'users', trimmedNewName);
      
      const newDocSnap = await getDoc(newDocRef);
      if (newDocSnap.exists()) {
        throw new Error("New name already exists.");
      }

      const batch = writeBatch(db);
      
      const oldClientData = (await getDoc(oldDocRef)).data();
      
      const clientData = { ...oldClientData, name: trimmedNewName, previousName: originalName };

      batch.set(newDocRef, clientData);
      batch.delete(oldDocRef);

      await batch.commit();

      toast({
        title: 'Successo!',
        description: `Il nome di ${originalName} è stato cambiato in ${trimmedNewName}. La modifica sarà applicata automaticamente al prossimo accesso del cliente.`,
      });
      onClientsUpdated(); 
      fetchClients();
      setClientToRename(null);
      setNewName('');
    } catch (error) {
      console.error("Error renaming client:", error);
      toast({ variant: 'destructive', title: 'Errore', description: 'Impossibile rinominare il cliente. Il nuovo nome potrebbe essere già in uso.' });
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
                        checked={client.isBlocked}
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
                    Inserisci il nuovo nome per il cliente. Questa operazione è permanente e si rifletterà automaticamente per il cliente al suo prossimo accesso.
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
