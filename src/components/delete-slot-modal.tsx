'use client';

import { useState, useEffect, useRef } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { DaySchedule, DayOfWeek, Slot } from '@/lib/types';
import { Info, Trash2 } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';
import { Checkbox } from './ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
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

export interface SlotToDelete {
  day: DayOfWeek;
  period: 'morning' | 'afternoon';
  slotId: string;
}

interface DeleteSlotModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: DaySchedule[];
  onDeleteSlots: (slots: SlotToDelete[]) => void;
}

export function DeleteSlotModal({ isOpen, onOpenChange, schedule, onDeleteSlots }: DeleteSlotModalProps) {
  const [selectedSlots, setSelectedSlots] = useState<Map<string, SlotToDelete>>(new Map());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isDeleteAllConfirmOpen, setDeleteAllConfirmOpen] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const slotsAvailable = schedule.some(day => day.morning.length > 0 || day.afternoon.length > 0);

  useEffect(() => {
    if (!isOpen) {
      setSelectedSlots(new Map());
      setIsSelectionMode(false);
      setDeleteAllConfirmOpen(false);
      cancelLongPress();
    }
  }, [isOpen]);

  const toggleSelection = (slot: Slot, day: DayOfWeek, period: 'morning' | 'afternoon') => {
    setSelectedSlots(prev => {
      const newSelection = new Map(prev);
      if (newSelection.has(slot.id)) {
        newSelection.delete(slot.id);
      } else {
        newSelection.set(slot.id, { day, period, slotId: slot.id });
      }
      if (newSelection.size === 0) {
        setIsSelectionMode(false);
      }
      return newSelection;
    });
  };

  const handleSlotClick = (slot: Slot, day: DayOfWeek, period: 'morning' | 'afternoon') => {
    if (!isSelectionMode) {
      setIsSelectionMode(true);
    }
    toggleSelection(slot, day, period);
  };
  
  const handleBulkDelete = () => {
    onDeleteSlots(Array.from(selectedSlots.values()));
    onOpenChange(false);
  };

  const handleDeleteAll = () => {
    const allSlotsToDelete: SlotToDelete[] = [];
    schedule.forEach(day => {
      day.morning.forEach(slot => allSlotsToDelete.push({ day: day.day, period: 'morning', slotId: slot.id }));
      day.afternoon.forEach(slot => allSlotsToDelete.push({ day: day.day, period: 'afternoon', slotId: slot.id }));
    });
    onDeleteSlots(allSlotsToDelete);
    onOpenChange(false);
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const startLongPress = () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    if (!slotsAvailable) return;
    longPressTimerRef.current = setTimeout(() => {
      setDeleteAllConfirmOpen(true);
    }, 1500);
  };
  
  const handleMainDeleteClick = () => {
    if (selectedSlots.size > 0) {
        handleBulkDelete();
    }
  };

  const renderSlotItem = (slot: Slot, day: DayOfWeek, period: 'morning' | 'afternoon') => {
    const isSelected = selectedSlots.has(slot.id);

    return (
      <div
        key={slot.id}
        className={cn(
          'flex items-center justify-between p-2 rounded-md bg-muted/50 transition-colors cursor-pointer hover:bg-muted',
          isSelected && 'bg-primary/20'
        )}
        onClick={() => handleSlotClick(slot, day, period)}
      >
        <div className="flex items-center gap-3 pointer-events-none">
            {isSelectionMode && (
              <Checkbox
                checked={isSelected}
                id={`cb-${slot.id}`}
                aria-label={`Seleziona ${slot.timeRange}`}
              />
            )}
            <label
              htmlFor={`cb-${slot.id}`}
              className={'cursor-pointer'}
            >
              <Badge variant={slot.bookedBy.length > 0 ? "secondary" : "default"}>
                {slot.timeRange} {slot.bookedBy.length > 0 && `(${slot.bookedBy.length})`}
              </Badge>
            </label>
        </div>
      </div>
    );
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancella Orari</DialogTitle>
            <DialogDescription>
              Clicca su un orario per selezionarlo. Tieni premuto il tasto "Cancella" per eliminare tutti gli orari.
            </DialogDescription>
          </DialogHeader>

          {isSelectionMode && (
              <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Modalità Selezione Attiva</AlertTitle>
                  <AlertDescription>
                      {selectedSlots.size} orari selezionati.
                  </AlertDescription>
              </Alert>
          )}

          <ScrollArea className="max-h-[50vh] -mr-6 pr-6">
            {slotsAvailable ? (
              <Accordion type="multiple" className="w-full">
                {schedule.map(daySchedule => {
                  const hasSlots = daySchedule.morning.length > 0 || daySchedule.afternoon.length > 0;
                  if (!hasSlots) return null;

                  return (
                    <AccordionItem value={daySchedule.day} key={daySchedule.day}>
                      <AccordionTrigger>{daySchedule.day}</AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4">
                          {daySchedule.morning.length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Mattina</h4>
                              <div className="space-y-2">
                                {daySchedule.morning.map(slot => renderSlotItem(slot, daySchedule.day, 'morning'))}
                              </div>
                            </div>
                          )}
                          {daySchedule.afternoon.length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Pomeriggio</h4>
                              <div className="space-y-2">
                                {daySchedule.afternoon.map(slot => renderSlotItem(slot, daySchedule.day, 'afternoon'))}
                              </div>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            ) : (
              <p className="text-center text-muted-foreground py-8">Non ci sono orari da cancellare.</p>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
            <Button
              variant="destructive"
              onClick={handleMainDeleteClick}
              disabled={!slotsAvailable}
              onMouseDown={startLongPress}
              onMouseUp={cancelLongPress}
              onMouseLeave={cancelLongPress}
              onTouchStart={startLongPress}
              onTouchEnd={cancelLongPress}
            >
              {selectedSlots.size > 0 ? `Cancella Selezionati (${selectedSlots.size})` : 'Cancella Orari'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isDeleteAllConfirmOpen} onOpenChange={setDeleteAllConfirmOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Sei assolutamente sicuro?</AlertDialogTitle>
                <AlertDialogDescription>
                    Questa operazione cancellerà TUTTI gli orari da TUTTI i giorni. Questa azione non può essere annullata.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={cancelLongPress}>Annulla</AlertDialogCancel>
                <AlertDialogAction
                    onClick={handleDeleteAll}
                    className={buttonVariants({ variant: "destructive" })}
                >
                    Sì, cancella tutto
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
