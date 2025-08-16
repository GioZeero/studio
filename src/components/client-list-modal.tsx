'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import type { ClientData } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { format, isPast } from 'date-fns';
import { it } from 'date-fns/locale';
import { Badge } from './ui/badge';

interface ClientListModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClientListModal({ isOpen, onOpenChange }: ClientListModalProps) {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [bankTotal, setBankTotal] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !db) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'client'));
        const querySnapshot = await getDocs(q);
        const clientList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as ClientData[];
        setClients(clientList.sort((a, b) => a.name.localeCompare(b.name)));

        const bankRef = doc(db, 'bank', 'total');
        const bankSnap = await getDoc(bankRef);
        if (bankSnap.exists()) {
          setBankTotal(bankSnap.data().amount);
        } else {
          setBankTotal(0);
        }
      } catch (error) {
        console.error("Error fetching client data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen]);

  const renderStatus = (client: ClientData) => {
    if (client.subscriptionStatus === 'suspended') {
      return <Badge variant="outline">Sospeso</Badge>;
    }
    if (!client.subscriptionExpiry) {
        return <Badge variant="destructive">Non Pagato</Badge>;
    }
    const expiryDate = new Date(client.subscriptionExpiry);
    if (isPast(expiryDate)) {
        return <Badge variant="destructive">Scaduto</Badge>;
    }
    return <Badge variant="secondary">Scade: {format(expiryDate, 'dd MMMM yyyy', { locale: it })}</Badge>;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Lista Clienti e Contabilità</DialogTitle>
          <DialogDescription>
            Visualizza lo stato degli abbonamenti e il totale in cassa.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <ScrollArea className="h-[40vh] border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Stato Abbonamento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-5 w-32 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : clients.length > 0 ? (
                  clients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell className="text-right">{renderStatus(client)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                    <TableRow>
                        <TableCell colSpan={2} className="text-center text-muted-foreground">Nessun cliente trovato.</TableCell>
                    </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
          <div className="p-4 bg-muted rounded-md text-center">
            <p className="text-sm text-muted-foreground">Totale in cassa (Banca)</p>
            {loading ? <Skeleton className="h-8 w-24 mx-auto mt-1" /> : (
              <p className="text-2xl font-bold">€{bankTotal.toFixed(2)}</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
