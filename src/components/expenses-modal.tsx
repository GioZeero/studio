'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { Button, buttonVariants } from '@/components/ui/button';
import { AddExpenseModal } from './add-expense-modal';
import type { User, Expense } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, orderBy, runTransaction, doc } from 'firebase/firestore';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExpensesModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
}

export function ExpensesModal({ isOpen, onOpenChange, user }: ExpensesModalProps) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddExpenseModalOpen, setAddExpenseModalOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [isProcessingDelete, setIsProcessingDelete] = useState(false);
  const { toast } = useToast();

  const fetchExpenses = async () => {
    if (!db) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'expenses'), orderBy('date', 'desc'));
      const querySnapshot = await getDocs(q);
      const expensesList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Expense[];
      setExpenses(expensesList);
    } catch (error) {
      console.error("Error fetching expenses:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchExpenses();
    }
  }, [isOpen]);

  const handleDeleteExpense = async () => {
    if (!db || !expenseToDelete) return;
    setIsProcessingDelete(true);

    try {
        await runTransaction(db, async (transaction) => {
            const expenseRef = doc(db, 'expenses', expenseToDelete.id);
            const bankRef = doc(db, 'bank', 'total');
            
            const bankSnap = await transaction.get(bankRef);
            const currentAmount = bankSnap.exists() ? bankSnap.data().amount : 0;
            const newAmount = currentAmount + expenseToDelete.cost;

            transaction.set(bankRef, { amount: newAmount }, { merge: true });
            transaction.delete(expenseRef);
        });

        toast({
            title: 'Successo!',
            description: 'La spesa è stata cancellata correttamente.',
        });
        fetchExpenses();
        setExpenseToDelete(null);
    } catch (error) {
        console.error('Error deleting expense:', error);
        toast({
            variant: 'destructive',
            title: 'Errore',
            description: 'Impossibile cancellare la spesa. Riprova.',
        });
    } finally {
        setIsProcessingDelete(false);
    }
  };


  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Elenco Spese Palestra</DialogTitle>
            <DialogDescription>
              Qui sono elencate tutte le spese sostenute dalla palestra.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <ScrollArea className="h-[40vh] border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Spesa</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Costo</TableHead>
                    {user?.role === 'owner' && <TableHead className="text-right">Azioni</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    [...Array(5)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                        {user?.role === 'owner' && <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>}
                      </TableRow>
                    ))
                  ) : expenses.length > 0 ? (
                    expenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell className="font-medium">{expense.name}</TableCell>
                        <TableCell>{format(new Date(expense.date), 'dd MMM yyyy', { locale: it })}</TableCell>
                        <TableCell>€{expense.cost.toFixed(2)}</TableCell>
                        {user?.role === 'owner' && (
                            <TableCell className="text-right">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setExpenseToDelete(expense)}
                                    disabled={isProcessingDelete}
                                >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </TableCell>
                        )}
                      </TableRow>
                    ))
                  ) : (
                      <TableRow>
                          <TableCell colSpan={user?.role === 'owner' ? 4 : 3} className="text-center text-muted-foreground h-24">Nessuna spesa registrata.</TableCell>
                      </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
          {user?.role === 'owner' && (
            <DialogFooter className="sm:justify-between">
              <Button variant="outline">Aggiungi Goal</Button>
              <Button onClick={() => setAddExpenseModalOpen(true)}>
                Aggiungi Spesa
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
      {user?.role === 'owner' && (
        <AddExpenseModal
            isOpen={isAddExpenseModalOpen}
            onOpenChange={setAddExpenseModalOpen}
            onExpenseAdded={fetchExpenses}
        />
      )}
      <AlertDialog open={!!expenseToDelete} onOpenChange={(open) => !open && setExpenseToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
                <AlertDialogDescription>
                    Questa azione cancellerà la spesa "{expenseToDelete?.name}" di €{expenseToDelete?.cost.toFixed(2)}.
                    Il costo verrà riaccreditato sulla cassa. L'azione non può essere annullata.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel disabled={isProcessingDelete}>Annulla</AlertDialogCancel>
                <AlertDialogAction
                    onClick={handleDeleteExpense}
                    disabled={isProcessingDelete}
                    className={cn(buttonVariants({ variant: "destructive" }))}
                >
                    {isProcessingDelete && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Cancella
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
