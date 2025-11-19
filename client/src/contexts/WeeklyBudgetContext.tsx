import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';

interface Payment {
  _id?: string;
  name: string;
  amount: number;
  scheduledDate: Date | string;
  status: 'pending' | 'paid' | 'overdue';
  paidDate?: Date | string;
  paymentScheduleId?: string;
  isRecurring: boolean;
  recurringId?: string;
  notes?: string;
}

interface Category {
  categoryId: string | any;
  allocation: number;
  payments: Payment[];
}

interface WeeklyBudget {
  _id: string;
  userId: string;
  weekStartDate: Date | string;
  weekEndDate: Date | string;
  totalBudget: number;
  creationMode: 'template' | 'smart' | 'manual';
  categories: Category[];
  template?: {
    fromWeekId: string;
    modifications: any[];
  };
  insights?: {
    suggestedTotal: number;
    topCategories: any[];
    recommendations: string[];
    comparedToAverage?: number;
  };
}

interface BudgetInsights {
  averageWeeklySpending: number;
  topCategories: Array<{
    categoryId: string;
    name: string;
    average: number;
    trend: 'up' | 'down' | 'stable';
  }>;
  savingsRate: number;
  recommendations: string[];
  suggestedTotal: number;
}

interface WeeklyBudgetContextType {
  // State
  currentBudget: WeeklyBudget | null;
  isLoading: boolean;
  error: string | null;
  
  // Computed values
  totalAllocated: number;
  totalScheduled: number;
  totalSpent: number;
  remainingBudget: number;
  isOverBudget: boolean;
  efficiency: number;
  warnings: string[];
  
  // Actions
  createBudget: (mode: 'template' | 'smart' | 'manual', data: any) => Promise<void>;
  updateCategory: (categoryId: string, allocation: number) => Promise<void>;
  addPaymentToCategory: (categoryId: string, payment: Omit<Payment, '_id'>) => Promise<void>;
  updatePaymentStatus: (paymentId: string, status: 'pending' | 'paid' | 'overdue') => Promise<void>;
  deleteCategory: (categoryId: string) => Promise<void>;
  deletePayment: (categoryId: string, paymentId: string) => Promise<void>;
  
  // Utilities
  getCategoryStats: (categoryId: string) => {
    allocated: number;
    scheduled: number;
    spent: number;
    remaining: number;
    percentageUsed: number;
  };
  canAddPayment: (categoryId: string, amount: number) => boolean;
  refreshBudget: () => void;
}

const WeeklyBudgetContext = createContext<WeeklyBudgetContextType | undefined>(undefined);

export const useWeeklyBudget = () => {
  const context = useContext(WeeklyBudgetContext);
  if (!context) {
    throw new Error('useWeeklyBudget must be used within a WeeklyBudgetProvider');
  }
  return context;
};

interface WeeklyBudgetProviderProps {
  children: React.ReactNode;
  weekStartDate?: Date;
}

export const WeeklyBudgetProvider: React.FC<WeeklyBudgetProviderProps> = ({ 
  children, 
  weekStartDate 
}) => {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  // Fetch current budget
  const { data: currentBudget, isLoading, refetch: refreshBudget } = useQuery({
    queryKey: ['weeklyBudget', 'current', weekStartDate],
    queryFn: async () => {
      const response = await axios.get('/api/weekly-budget/current');
      return response.data as WeeklyBudget;
    },
    staleTime: 30000, // 30 seconds
  });
  
  // Convert undefined to null for the interface
  const currentBudgetOrNull = currentBudget || null;

  // Create budget mutation
  const createBudgetMutation = useMutation({
    mutationFn: async ({ mode, data }: { mode: string; data: any }) => {
      console.log('Creating budget with mode:', mode, 'data:', data);
      const response = await axios.post('/api/weekly-budget/smart-create', {
        mode,
        ...data,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weeklyBudget'] });
      toast.success('Budget created successfully!');
    },
    onError: (error: any) => {
      console.error('Budget creation error:', error);
      const errorMessage = error.response?.data?.error || 'Failed to create budget';
      toast.error(errorMessage);
      setError(errorMessage);
    },
  });

  // Add payment mutation
  const addPaymentMutation = useMutation({
    mutationFn: async ({ 
      budgetId, 
      categoryId, 
      payment 
    }: { 
      budgetId: string; 
      categoryId: string; 
      payment: any;
    }) => {
      const response = await axios.post(
        `/api/weekly-budget/${budgetId}/category/${categoryId}/payment`,
        payment
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weeklyBudget'] });
      toast.success('Payment added successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to add payment');
    },
  });

  // Update payment status mutation
  const updatePaymentStatusMutation = useMutation({
    mutationFn: async ({ 
      budgetId, 
      paymentId, 
      status 
    }: { 
      budgetId: string; 
      paymentId: string; 
      status: string;
    }) => {
      const response = await axios.patch(
        `/api/weekly-budget/${budgetId}/payment/${paymentId}/status`,
        { status }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weeklyBudget'] });
      toast.success('Payment updated!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update payment');
    },
  });

  // Computed values
  const computedValues = useMemo(() => {
    if (!currentBudget) {
      return {
        totalAllocated: 0,
        totalScheduled: 0,
        totalSpent: 0,
        remainingBudget: 0,
        isOverBudget: false,
        efficiency: 0,
        warnings: [],
      };
    }

    const totalAllocated = currentBudget.categories.reduce(
      (sum, cat) => sum + cat.allocation, 
      0
    );

    const totalScheduled = currentBudget.categories.reduce(
      (sum, cat) => sum + cat.payments.reduce((pSum, p) => pSum + p.amount, 0), 
      0
    );

    const totalSpent = currentBudget.categories.reduce(
      (sum, cat) => sum + cat.payments
        .filter(p => p.status === 'paid')
        .reduce((pSum, p) => pSum + p.amount, 0), 
      0
    );

    const remainingBudget = currentBudget.totalBudget - totalAllocated;
    const isOverBudget = totalScheduled > currentBudget.totalBudget;
    const efficiency = currentBudget.totalBudget > 0 
      ? (totalSpent / currentBudget.totalBudget) * 100 
      : 0;

    const warnings: string[] = [];
    if (isOverBudget) {
      warnings.push('Scheduled payments exceed total budget');
    }
    if (totalAllocated > currentBudget.totalBudget) {
      warnings.push('Category allocations exceed total budget');
    }
    
    currentBudget.categories.forEach(cat => {
      const catScheduled = cat.payments.reduce((sum, p) => sum + p.amount, 0);
      if (catScheduled > cat.allocation) {
        const categoryName = typeof cat.categoryId === 'object' 
          ? cat.categoryId.name 
          : 'Category';
        warnings.push(`${categoryName} payments exceed allocation`);
      }
    });

    return {
      totalAllocated,
      totalScheduled,
      totalSpent,
      remainingBudget,
      isOverBudget,
      efficiency,
      warnings,
    };
  }, [currentBudget]);

  // Action methods
  const createBudget = useCallback(async (
    mode: 'template' | 'smart' | 'manual',
    data: any
  ) => {
    await createBudgetMutation.mutateAsync({ mode, data });
  }, [createBudgetMutation]);

  const updateCategory = useCallback(async (
    categoryId: string,
    allocation: number
  ) => {
    // TODO: Implement category update
    toast.info('Category update not implemented yet');
  }, []);

  const addPaymentToCategory = useCallback(async (
    categoryId: string,
    payment: Omit<Payment, '_id'>
  ) => {
    if (!currentBudget) return;
    
    await addPaymentMutation.mutateAsync({
      budgetId: currentBudget._id,
      categoryId,
      payment,
    });
  }, [currentBudget, addPaymentMutation]);

  const updatePaymentStatus = useCallback(async (
    paymentId: string,
    status: 'pending' | 'paid' | 'overdue'
  ) => {
    if (!currentBudget) return;
    
    await updatePaymentStatusMutation.mutateAsync({
      budgetId: currentBudget._id,
      paymentId,
      status,
    });
  }, [currentBudget, updatePaymentStatusMutation]);

  // Delete category mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: async ({ budgetId, categoryId }: { budgetId: string; categoryId: string }) => {
      const response = await axios.delete(
        `/api/weekly-budget/${budgetId}/category/${categoryId}`
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weeklyBudget'] });
      toast.success('Category removed successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to remove category');
    },
  });

  // Delete payment mutation
  const deletePaymentMutation = useMutation({
    mutationFn: async ({ 
      budgetId, 
      categoryId, 
      paymentId 
    }: { 
      budgetId: string; 
      categoryId: string; 
      paymentId: string;
    }) => {
      const response = await axios.delete(
        `/api/weekly-budget/${budgetId}/category/${categoryId}/payment/${paymentId}`
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weeklyBudget'] });
      toast.success('Payment removed successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to remove payment');
    },
  });

  const deleteCategory = useCallback(async (categoryId: string) => {
    if (!currentBudget) return;
    
    await deleteCategoryMutation.mutateAsync({
      budgetId: currentBudget._id,
      categoryId,
    });
  }, [currentBudget, deleteCategoryMutation]);

  const deletePayment = useCallback(async (
    categoryId: string,
    paymentId: string
  ) => {
    if (!currentBudget) return;
    
    await deletePaymentMutation.mutateAsync({
      budgetId: currentBudget._id,
      categoryId,
      paymentId,
    });
  }, [currentBudget, deletePaymentMutation]);

  // Utility methods
  const getCategoryStats = useCallback((categoryId: string) => {
    if (!currentBudget) {
      return {
        allocated: 0,
        scheduled: 0,
        spent: 0,
        remaining: 0,
        percentageUsed: 0,
      };
    }

    const category = currentBudget.categories.find(
      cat => cat.categoryId === categoryId || cat.categoryId._id === categoryId
    );

    if (!category) {
      return {
        allocated: 0,
        scheduled: 0,
        spent: 0,
        remaining: 0,
        percentageUsed: 0,
      };
    }

    const scheduled = category.payments.reduce((sum, p) => sum + p.amount, 0);
    const spent = category.payments
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + p.amount, 0);

    return {
      allocated: category.allocation,
      scheduled,
      spent,
      remaining: category.allocation - scheduled,
      percentageUsed: category.allocation > 0 
        ? (spent / category.allocation) * 100 
        : 0,
    };
  }, [currentBudget]);

  const canAddPayment = useCallback((categoryId: string, amount: number): boolean => {
    const stats = getCategoryStats(categoryId);
    return stats.remaining >= amount;
  }, [getCategoryStats]);

  const value: WeeklyBudgetContextType = {
    currentBudget: currentBudgetOrNull,
    isLoading,
    error,
    ...computedValues,
    createBudget,
    updateCategory,
    addPaymentToCategory,
    updatePaymentStatus,
    deleteCategory,
    deletePayment,
    getCategoryStats,
    canAddPayment,
    refreshBudget,
  };

  return (
    <WeeklyBudgetContext.Provider value={value}>
      {children}
    </WeeklyBudgetContext.Provider>
  );
};
