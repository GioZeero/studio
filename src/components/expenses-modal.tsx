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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { AddExpenseModal } from './add-expense-modal';
import type { User, Expense } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface ExpensesModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
}

export function ExpensesModal({ isOpen, onOpenChange, user }: ExpensesModalProps) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddExpenseModalOpen, setAddExpenseModalOpen] = useState(false);

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
                    <TableHead className="text-right">Costo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    [...Array(5)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : expenses.length > 0 ? (
                    expenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell className="font-medium">{expense.name}</TableCell>
                        <TableCell>{format(new Date(expense.date), 'dd MMM yyyy', { locale: it })}</TableCell>
                        <TableCell className="text-right">€{expense.cost.toFixed(2)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                      <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground h-24">Nessuna spesa registrata.</TableCell>
                      </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
          {user?.role === 'owner' && (
            <DialogFooter>
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
    </>
  );
}
