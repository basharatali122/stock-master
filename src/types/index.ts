export type UserRole = 'admin' | 'order_booker';

export type UserStatus = 'pending' | 'approved' | 'rejected' | 'inactive';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  assignedRouteId?: string;
  createdAt: Date;
}

export interface City {
  id: string;
  name: string;
  createdAt: Date;
}

export interface Route {
  id: string;
  name: string;
  cityId: string;
  cityName: string;
  assignedBookerId?: string;
  assignedBookerName?: string;
  activeDays: string[];
  isActive: boolean;
  createdAt: Date;
}

export interface Shop {
  id: string;
  name: string;
  ownerName: string;
  phone: string;
  address: string;
  routeId: string;
  routeName: string;
  creditBalance: number;
  pendingBalance: number;
  createdAt: Date;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  costPrice: number;
  stockQuantity: number;
  discount: number;
  sku: string;
  createdAt: Date;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  discount: number;
  total: number;
}

export type OrderStatus = 'pending' | 'confirmed' | 'delivered' | 'cancelled';
export type PaymentStatus = 'paid' | 'credit' | 'partial';

export interface Order {
  id: string;
  shopId: string;
  shopName: string;
  routeId: string;
  routeName: string;
  bookerId: string;
  bookerName: string;
  items: OrderItem[];
  totalAmount: number;
  paidAmount: number;
  creditAmount: number;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  createdAt: Date;
}

export interface ReturnItem {
  productId: string;
  productName: string;
  quantity: number;
  reason: string;
}

export interface ProductReturn {
  id: string;
  shopId: string;
  shopName: string;
  routeId: string;
  bookerId: string;
  bookerName: string;
  items: ReturnItem[];
  totalValue: number;
  createdAt: Date;
}

export interface BookerFinancials {
  bookerId: string;
  bookerName: string;
  totalOrders: number;
  totalCashCollected: number;
  totalCreditGiven: number;
  pendingAmount: number;
  salary: number;
  advanceTaken: number;
  remainingBalance: number;
}

export interface DashboardStats {
  totalSales: number;
  totalOrders: number;
  totalShops: number;
  totalProducts: number;
  pendingPayments: number;
  lowStockProducts: number;
  activeRoutes: number;
  pendingApprovals: number;
}
