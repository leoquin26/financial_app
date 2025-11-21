import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { MaterialIcons } from '@expo/vector-icons';
import api from '../services/api';

interface DashboardData {
  summary: {
    totalIncome: number;
    totalExpenses: number;
    balance: number;
  };
  recentTransactions: Array<{
    id: string;
    type: 'income' | 'expense';
    amount: number;
    category_name: string;
    date: string;
  }>;
}

export default function DashboardScreen({ navigation }: any) {
  const { data, isLoading, refetch } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const response = await api.get('/api/dashboard/summary');
      return response.data;
    },
  });

  const formatCurrency = (amount: number) => {
    return `S/ ${amount.toFixed(2)}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Dashboard</Text>
          <Text style={styles.date}>{new Date().toDateString()}</Text>
        </View>

        {/* Summary Cards */}
        <View style={styles.cardsContainer}>
          <View style={[styles.card, styles.incomeCard]}>
            <MaterialIcons name="trending-up" size={24} color="#4CAF50" />
            <Text style={styles.cardLabel}>Income</Text>
            <Text style={styles.cardAmount}>
              {formatCurrency(data?.summary.totalIncome || 0)}
            </Text>
          </View>

          <View style={[styles.card, styles.expenseCard]}>
            <MaterialIcons name="trending-down" size={24} color="#F44336" />
            <Text style={styles.cardLabel}>Expenses</Text>
            <Text style={styles.cardAmount}>
              {formatCurrency(data?.summary.totalExpenses || 0)}
            </Text>
          </View>

          <View style={[styles.card, styles.balanceCard]}>
            <MaterialIcons name="account-balance-wallet" size={24} color="#2196F3" />
            <Text style={styles.cardLabel}>Balance</Text>
            <Text style={styles.cardAmount}>
              {formatCurrency(data?.summary.balance || 0)}
            </Text>
          </View>
        </View>

        {/* Recent Transactions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Transactions')}
            >
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>

          {data?.recentTransactions.map((transaction) => (
            <TouchableOpacity
              key={transaction.id}
              style={styles.transactionItem}
              onPress={() =>
                navigation.navigate('TransactionDetail', { id: transaction.id })
              }
            >
              <View style={styles.transactionLeft}>
                <MaterialIcons
                  name={
                    transaction.type === 'income'
                      ? 'add-circle'
                      : 'remove-circle'
                  }
                  size={24}
                  color={transaction.type === 'income' ? '#4CAF50' : '#F44336'}
                />
                <View style={styles.transactionInfo}>
                  <Text style={styles.transactionCategory}>
                    {transaction.category_name}
                  </Text>
                  <Text style={styles.transactionDate}>
                    {new Date(transaction.date).toLocaleDateString()}
                  </Text>
                </View>
              </View>
              <Text
                style={[
                  styles.transactionAmount,
                  transaction.type === 'income'
                    ? styles.incomeAmount
                    : styles.expenseAmount,
                ]}
              >
                {transaction.type === 'income' ? '+' : '-'}
                {formatCurrency(transaction.amount)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('QuickPayment')}
      >
        <MaterialIcons name="flash-on" size={24} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  date: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  cardsContainer: {
    paddingHorizontal: 20,
    gap: 15,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  incomeCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  expenseCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  balanceCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  cardLabel: {
    fontSize: 14,
    color: '#666',
    marginLeft: 10,
    flex: 1,
  },
  cardAmount: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  section: {
    marginTop: 30,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  seeAll: {
    fontSize: 14,
    color: '#7C3AED',
  },
  transactionItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  transactionInfo: {
    marginLeft: 10,
    flex: 1,
  },
  transactionCategory: {
    fontSize: 16,
    color: '#333',
  },
  transactionDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  incomeAmount: {
    color: '#4CAF50',
  },
  expenseAmount: {
    color: '#F44336',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
});
