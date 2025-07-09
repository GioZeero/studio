'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { AddGoalModal } from './add-goal-modal';
import type { User, Expense, Goal } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, orderBy, runTransaction, doc, writeBatch, deleteDoc, getDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from './ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

interface ExpensesModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
}

export function ExpensesModal({ isOpen, onOpenChange, user }: ExpensesModalProps) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [bankTotal, setBankTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [isAddExpenseModalOpen, setAddExpenseModalOpen] = useState(false);
  const [isAddGoalModalOpen, setAddGoalModalOpen] = useState(false);
  
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [isProcessingDelete, setIsProcessingDelete] = useState(false);
  
  const [goalToDelete, setGoalToDelete] = useState<Goal | null>(null);
  const [isProcessingGoalDelete, setIsProcessingGoalDelete] = useState(false);

  const { toast } = useToast();

  const fetchData = async () => {
    if (!db) return;
    setLoading(true);
    try {
      const expensesQuery = query(collection(db, 'expenses'), orderBy('date', 'desc'));
      const goalsQuery = query(collection(db, 'goals'), orderBy('createdAt', 'desc'));
      const bankRef = doc(db, 'bank', 'total');

      const [expensesSnapshot, goalsSnapshot, bankSnap] = await Promise.all([
        getDocs(expensesQuery),
        getDocs(goalsQuery),
        getDoc(bankRef)
      ]);

      const expensesList = expensesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Expense[];
      const goalsList = goalsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Goal[];
      const currentBankTotal = bankSnap.exists() ? bankSnap.data().amount : 0;
      
      setExpenses(expensesList);
      setBankTotal(currentBankTotal);
      
      const activeGoals = goalsList.filter(g => g.status === 'active');
      const goalsToUpdate = activeGoals.filter(g => currentBankTotal >= g.cost);

      if (goalsToUpdate.length > 0) {
        const batch = writeBatch(db);
        goalsToUpdate.forEach(goal => {
          const goalRef = doc(db, 'goals', goal.id);
          batch.update(goalRef, { status: 'completed', completedAt: new Date().toISOString() });
        });
        await batch.commit();

        const updatedGoalsList = goalsList.map(g => {
            if (goalsToUpdate.some(gu => gu.id === g.id)) {
                return { ...g, status: 'completed' as 'completed' };
            }
            return g;
        });
        setGoals(updatedGoalsList);
      } else {
        setGoals(goalsList);
      }

    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchData();
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
        fetchData();
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

  const handleDeleteGoal = async () => {
    if (!db || !goalToDelete) return;
    setIsProcessingGoalDelete(true);

    try {
        await deleteDoc(doc(db, 'goals', goalToDelete.id));
        toast({
            title: 'Successo!',
            description: 'Obiettivo cancellato.',
        });
        fetchData();
        setGoalToDelete(null);
    } catch (error) {
        console.error('Error deleting goal:', error);
        toast({
            variant: 'destructive',
            title: 'Errore',
            description: 'Impossibile cancellare l\'obiettivo. Riprova.',
        });
    } finally {
        setIsProcessingGoalDelete(false);
    }
  };
  
  const activeGoals = useMemo(() => goals.filter(g => g.status === 'active'), [goals]);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Spese e Obiettivi Palestra</DialogTitle>
            <DialogDescription>
              Monitora le finanze e gli obiettivi di crescita della palestra.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 max-h-[60vh] overflow-y-auto -mr-6 pr-6 py-4">
            <Card>
                <CardHeader>
                    <CardTitle>Elenco Spese</CardTitle>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[30vh] border rounded-md">
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
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader>
                    <CardTitle>Obiettivi</CardTitle>
                    <CardDescription>Monitora i prossimi traguardi della palestra.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {loading ? (
                         [...Array(2)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
                    ) : activeGoals.length > 0 ? (
                       activeGoals.map((goal) => (
                        <div key={goal.id}>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-sm font-medium">{goal.name}</span>
                                {user?.role === 'owner' && (
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setGoalToDelete(goal)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                )}
                            </div>
                            <Progress value={(bankTotal / goal.cost) * 100} />
                            <p className="text-xs text-muted-foreground text-right mt-1">€{Math.min(bankTotal, goal.cost).toFixed(0)} / €{goal.cost.toFixed(0)}</p>
                        </div>
                       ))
                    ) : (
                        <p className="text-sm text-center text-muted-foreground py-4">Nessun obiettivo attivo al momento.</p>
                    )}
                </CardContent>
            </Card>
          </div>
          {user?.role === 'owner' && (
            <DialogFooter className="sm:justify-between pt-4">
              <Button variant="outline" onClick={() => setAddGoalModalOpen(true)}>Aggiungi Goal</Button>
              <Button onClick={() => setAddExpenseModalOpen(true)}>
                Aggiungi Spesa
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
      {user?.role === 'owner' && (
        <>
            <AddExpenseModal
                isOpen={isAddExpenseModalOpen}
                onOpenChange={setAddExpenseModalOpen}
                onExpenseAdded={fetchData}
            />
            <AddGoalModal
                isOpen={isAddGoalModalOpen}
                onOpenChange={setAddGoalModalOpen}
                onGoalAdded={fetchData}
            />
        </>
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
    <AlertDialog open={!!goalToDelete} onOpenChange={(open) => !open && setGoalToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
                <AlertDialogDescription>
                    Questa azione cancellerà l'obiettivo "{goalToDelete?.name}". L'azione non può essere annullata e non influenzerà il totale in cassa.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel disabled={isProcessingGoalDelete}>Annulla</AlertDialogCancel>
                <AlertDialogAction
                    onClick={handleDeleteGoal}
                    disabled={isProcessingGoalDelete}
                    className={cn(buttonVariants({ variant: "destructive" }))}
                >
                    {isProcessingGoalDelete && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Cancella
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
