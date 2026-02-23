import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  Menu, 
  X, 
  Sun, 
  Moon, 
  LogOut, 
  Users, 
  History, 
  Calendar as CalendarIcon,
  MessageCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Phone,
  Edit2,
  Check,
  RotateCcw,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  format, 
  addDays, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameDay, 
  isToday, 
  startOfMonth, 
  endOfMonth, 
  isSameMonth,
  addMonths,
  subMonths,
  parseISO,
  isPast,
  addMinutes,
  isBefore
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { User, Client, ViewTab, ClientStatus } from './types';
import { cn, formatPhone, getWhatsAppUrl } from './lib/utils';

// --- Components ---

const Button = ({ 
  children, 
  className, 
  variant = 'primary', 
  size = 'md',
  ...props 
}: any) => {
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700',
    outline: 'border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800',
    ghost: 'text-gray-600 hover:bg-gray-100 dark:text-zinc-400 dark:hover:bg-zinc-800',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg',
    icon: 'p-2',
  };
  return (
    <button 
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant as keyof typeof variants],
        sizes[size as keyof typeof sizes],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

const Card: React.FC<{ children: React.ReactNode, className?: string, status?: 'overdue' | 'upcoming' | 'ontime' | 'completed' }> = ({ children, className, status }) => {
  const statusColors = {
    overdue: 'border-l-4 border-l-red-500',
    upcoming: 'border-l-4 border-l-yellow-500',
    ontime: 'border-l-4 border-l-blue-500',
    completed: 'border-l-4 border-l-emerald-500',
  };
  return (
    <div className={cn(
      'bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 overflow-hidden',
      status && statusColors[status],
      className
    )}>
      {children}
    </div>
  );
};

const Input = ({ className, ...props }: any) => (
  <input 
    className={cn(
      'w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none transition-all',
      className
    )}
    {...props}
  />
);

const Textarea = ({ className, ...props }: any) => (
  <textarea 
    className={cn(
      'w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none transition-all min-h-[100px]',
      className
    )}
    {...props}
  />
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  });
  const [clients, setClients] = useState<Client[]>(() => {
    const saved = localStorage.getItem('clients');
    return saved ? JSON.parse(saved) : [];
  });
  const [sellers, setSellers] = useState<User[]>([]);
  const [currentTab, setCurrentTab] = useState<ViewTab>('HOJE');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // WebSocket connection
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'CLIENT_UPDATED' || data.type === 'USER_UPDATED') {
        fetchClients();
        if (user?.role === 'admin') fetchSellers();
      }
    };

    return () => ws.close();
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchClients();
      if (user.role === 'admin') fetchSellers();
    }
  }, [user]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const fetchClients = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/clients?seller_id=${user.id}&role=${user.role}`);
      const data = await res.json();
      setClients(data);
      localStorage.setItem('clients', JSON.stringify(data));
    } catch (e) {
      console.error("Offline mode: using cached clients");
    }
  };

  const fetchSellers = async () => {
    const res = await fetch('/api/users');
    const data = await res.json();
    setSellers(data);
  };

  const handleLogin = async (email: string) => {
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data);
        localStorage.setItem('user', JSON.stringify(data));
      } else {
        alert(data.error);
      }
    } catch (e) {
      alert('Erro ao fazer login.');
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  const handleSaveClient = async (clientData: any) => {
    const url = editingClient ? `/api/clients/${editingClient.id}` : '/api/clients';
    const method = editingClient ? 'PUT' : 'POST';
    
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...clientData, seller_id: user?.id }),
    });

    if (res.ok) {
      setIsClientModalOpen(false);
      setEditingClient(null);
      fetchClients();
    }
  };

  const handleToggleUserActive = async (userId: number, active: boolean) => {
    await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    });
    fetchSellers();
  };

  const handleAddSeller = async (name: string, email: string) => {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email }),
    });
    if (res.ok) {
      fetchSellers();
    } else {
      const data = await res.json();
      alert(data.error);
    }
  };

  const getClientStatus = (client: Client) => {
    if (client.status === 'completed') return 'completed';
    if (!client.scheduled_at) return 'ontime';
    
    const scheduled = parseISO(client.scheduled_at);
    const now = new Date();
    
    if (isBefore(scheduled, now)) return 'overdue';
    if (isBefore(scheduled, addMinutes(now, 30))) return 'upcoming';
    return 'ontime';
  };

  const filteredClients = useMemo(() => {
    let list = clients;
    
    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c => 
        c.name.toLowerCase().includes(q) || 
        c.phone.includes(q)
      );
    }

    // Tab filter
    if (currentTab === 'HOJE') {
      list = list.filter(c => c.status === 'pending' && c.scheduled_at && isToday(parseISO(c.scheduled_at)));
    } else if (currentTab === 'SEMANA') {
      const start = startOfWeek(selectedDate, { weekStartsOn: 0 });
      const end = endOfWeek(selectedDate, { weekStartsOn: 0 });
      list = list.filter(c => c.scheduled_at && isSameDay(parseISO(c.scheduled_at), selectedDate));
    } else if (currentTab === 'MÊS') {
      list = list.filter(c => c.scheduled_at && isSameDay(parseISO(c.scheduled_at), selectedDate));
    } else if (currentTab === 'FALAR_AGORA') {
      list = list.filter(c => c.status === 'pending' && !c.scheduled_at);
    } else if (currentTab === 'HISTORICO') {
      list = list.filter(c => c.status === 'completed');
    }

    return list;
  }, [clients, currentTab, searchQuery, selectedDate]);

  const clientsWithoutSchedule = useMemo(() => {
    return clients.filter(c => c.status === 'pending' && !c.scheduled_at);
  }, [clients]);

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 font-sans transition-colors">
      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 bottom-0 w-72 bg-white dark:bg-zinc-900 border-r border-gray-200 dark:border-zinc-800 z-50 transition-transform lg:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">Y</div>
              <h1 className="font-bold text-lg leading-tight">Gabriel<br/>Agendamento</h1>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg">
              <X size={20} />
            </button>
          </div>

          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            <SidebarItem 
              icon={<CalendarIcon size={20} />} 
              label="Agendamentos" 
              active={!isAdminPanelOpen && currentTab !== 'HISTORICO'} 
              onClick={() => {
                setIsAdminPanelOpen(false);
                setCurrentTab('HOJE');
                setIsSidebarOpen(false);
              }} 
            />
            <SidebarItem 
              icon={<History size={20} />} 
              label="Histórico" 
              active={currentTab === 'HISTORICO'} 
              onClick={() => {
                setIsAdminPanelOpen(false);
                setCurrentTab('HISTORICO');
                setIsSidebarOpen(false);
              }} 
            />
            {user.role === 'admin' && (
              <SidebarItem 
                icon={<Users size={20} />} 
                label="Vendedores" 
                active={isAdminPanelOpen} 
                onClick={() => {
                  setIsAdminPanelOpen(true);
                  setIsSidebarOpen(false);
                }} 
              />
            )}
          </nav>

          <div className="p-4 border-t border-gray-200 dark:border-zinc-800">
            <div className="flex items-center gap-3 mb-4 p-2">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-medium">
                {user.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{user.name}</p>
                <p className="text-xs text-gray-500 dark:text-zinc-400 truncate">{user.email}</p>
              </div>
            </div>
            <Button variant="ghost" className="w-full justify-start gap-3" onClick={handleLogout}>
              <LogOut size={20} />
              Sair
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-72 min-h-screen flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-gray-200 dark:border-zinc-800 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg">
              <Menu size={24} />
            </button>

            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text"
                placeholder="Pesquisar por nome ou telefone..."
                className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <button 
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="p-2.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
          </div>
        </header>

        <div className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full">
          {isAdminPanelOpen ? (
            <AdminPanel sellers={sellers} onAddSeller={handleAddSeller} onToggleActive={handleToggleUserActive} />
          ) : (
            <>
              {/* Tabs */}
              <div className="flex flex-col gap-6 mb-8">
                <div className="flex items-center justify-center p-1 bg-gray-100 dark:bg-zinc-800 rounded-xl w-fit mx-auto">
                  <TabButton active={currentTab === 'HOJE'} onClick={() => setCurrentTab('HOJE')}>HOJE</TabButton>
                  <TabButton active={currentTab === 'SEMANA'} onClick={() => setCurrentTab('SEMANA')}>SEMANA</TabButton>
                  <TabButton active={currentTab === 'MÊS'} onClick={() => setCurrentTab('MÊS')}>MÊS</TabButton>
                  <TabButton active={currentTab === 'FALAR_AGORA'} onClick={() => setCurrentTab('FALAR_AGORA')}>FALAR AGORA</TabButton>
                </div>

                {currentTab === 'SEMANA' && (
                  <WeekSelector selectedDate={selectedDate} onSelect={setSelectedDate} />
                )}

                {currentTab === 'MÊS' && (
                  <MonthCalendar selectedDate={selectedDate} onSelect={setSelectedDate} clients={clients} />
                )}
              </div>

              {/* Client List */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredClients.length > 0 ? (
                  filteredClients.map(client => (
                    <ClientCard 
                      key={client.id} 
                      client={client} 
                      status={getClientStatus(client)}
                      onEdit={() => {
                        setEditingClient(client);
                        setIsClientModalOpen(true);
                      }}
                      onConclude={async () => {
                        await fetch(`/api/clients/${client.id}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ ...client, status: 'completed' }),
                        });
                        fetchClients();
                      }}
                      onReopen={async () => {
                        await fetch(`/api/clients/${client.id}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ ...client, status: 'pending' }),
                        });
                        fetchClients();
                      }}
                      onDelete={async () => {
                        if (confirm('Deseja excluir este cliente?')) {
                          await fetch(`/api/clients/${client.id}`, { method: 'DELETE' });
                          fetchClients();
                        }
                      }}
                    />
                  ))
                ) : (
                  <div className="col-span-full py-20 text-center text-gray-500 dark:text-zinc-500">
                    <CalendarIcon size={48} className="mx-auto mb-4 opacity-20" />
                    <p>Nenhum agendamento encontrado para este período.</p>
                  </div>
                )}
              </div>

              {/* Falar Agora Section (when in Today view) */}
              {currentTab === 'HOJE' && clientsWithoutSchedule.length > 0 && (
                <div className="mt-12">
                  <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <MessageCircle size={24} className="text-blue-600" />
                    Falar Agora
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {clientsWithoutSchedule.map(client => (
                      <ClientCard 
                        key={client.id} 
                        client={client} 
                        status="ontime"
                        onEdit={() => {
                          setEditingClient(client);
                          setIsClientModalOpen(true);
                        }}
                        onConclude={async () => {
                          await fetch(`/api/clients/${client.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ...client, status: 'completed' }),
                          });
                          fetchClients();
                        }}
                        onDelete={async () => {
                          if (confirm('Deseja excluir este cliente?')) {
                            await fetch(`/api/clients/${client.id}`, { method: 'DELETE' });
                            fetchClients();
                          }
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* FAB */}
        <button 
          onClick={() => {
            setEditingClient(null);
            setIsClientModalOpen(true);
          }}
          className="fixed bottom-8 right-8 w-16 h-16 bg-blue-600 text-white rounded-full shadow-xl shadow-blue-500/20 flex items-center justify-center hover:bg-blue-700 hover:scale-110 transition-all z-40"
        >
          <Plus size={32} />
        </button>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {isClientModalOpen && (
          <ClientModal 
            client={editingClient} 
            onClose={() => setIsClientModalOpen(false)} 
            onSave={handleSaveClient} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Sub-components ---

function LoginScreen({ onLogin }: { onLogin: (email: string) => void }) {
  const [email, setEmail] = useState('');
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-950 p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-3xl mx-auto mb-4 shadow-lg shadow-blue-500/20">Y</div>
          <h1 className="text-2xl font-bold">Gabriel Agendamento</h1>
          <p className="text-gray-500 dark:text-zinc-400 mt-2">Acesse sua conta para gerenciar clientes</p>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onLogin(email); }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">E-mail</label>
            <Input 
              type="email" 
              placeholder="seu@email.com" 
              required 
              value={email}
              onChange={(e: any) => setEmail(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full py-3">Entrar</Button>
        </form>
      </Card>
    </div>
  );
}

function SidebarItem({ icon, label, active, onClick }: { icon: any, label: string, active?: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
        active 
          ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 font-semibold" 
          : "text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function TabButton({ children, active, onClick }: { children: React.ReactNode, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
        active 
          ? "bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm" 
          : "text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100"
      )}
    >
      {children}
    </button>
  );
}

const ClientCard: React.FC<{ 
  client: Client, 
  status: 'overdue' | 'upcoming' | 'ontime' | 'completed',
  onEdit: () => void,
  onConclude: () => void | Promise<void>,
  onReopen?: () => void | Promise<void>,
  onDelete: () => void | Promise<void>
}> = ({ client, status, onEdit, onConclude, onReopen, onDelete }) => {
  const statusLabels = {
    overdue: { label: 'Atrasado', color: 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400' },
    upcoming: { label: 'Próximos 30 min', color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400' },
    ontime: { label: 'No prazo', color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400' },
    completed: { label: 'Concluído', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400' },
  };

  const handleWhatsApp = () => {
    const message = client.whatsapp_message || `Olá ${client.name}, aqui é o vendedor da Yamaha. Gostaria de falar sobre seu interesse em nossas motos.`;
    window.open(getWhatsAppUrl(client.phone, message), '_blank');
  };

  return (
    <Card status={status} className="flex flex-col h-full">
      <div className="p-5 flex-1">
        <div className="flex justify-between items-start mb-4">
          <span className={cn("text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full", statusLabels[status].color)}>
            {statusLabels[status].label}
          </span>
          {client.scheduled_at && (
            <div className="flex items-center gap-1.5 text-gray-500 dark:text-zinc-400 text-sm font-medium">
              <Clock size={14} />
              {format(parseISO(client.scheduled_at), "HH:mm")}
            </div>
          )}
        </div>

        <h3 className="text-lg font-bold mb-1 truncate">{client.name}</h3>
        <p className="text-gray-500 dark:text-zinc-400 text-sm mb-4 flex items-center gap-1.5">
          <Phone size={14} />
          {formatPhone(client.phone)}
        </p>
        
        {client.description && (
          <p className="text-sm text-gray-600 dark:text-zinc-400 line-clamp-2 bg-gray-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-gray-100 dark:border-zinc-800">
            {client.description}
          </p>
        )}

        {client.seller_name && (
          <p className="mt-4 text-[10px] text-gray-400 uppercase tracking-widest">Vendedor: {client.seller_name}</p>
        )}
      </div>

      <div className="p-3 bg-gray-50 dark:bg-zinc-800/50 border-t border-gray-100 dark:border-zinc-800 flex items-center gap-2">
        <Button variant="ghost" size="icon" className="text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20" onClick={handleWhatsApp}>
          <MessageCircle size={18} />
        </Button>
        <Button variant="ghost" size="icon" onClick={onEdit}>
          <Edit2 size={18} />
        </Button>
        <div className="flex-1" />
        {client.status === 'completed' ? (
          <Button variant="ghost" size="icon" className="text-emerald-600" onClick={onReopen}>
            <RotateCcw size={18} />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" className="text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20" onClick={onConclude}>
            <Check size={20} />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={onDelete}>
          <Trash2 size={18} />
        </Button>
      </div>
    </Card>
  );
}

function ClientModal({ client, onClose, onSave }: { client: Client | null, onClose: () => void, onSave: (data: any) => void }) {
  const [name, setName] = useState(client?.name || '');
  const [phone, setPhone] = useState(client?.phone || '');
  const [description, setDescription] = useState(client?.description || '');
  const [whatsappMessage, setWhatsappMessage] = useState(client?.whatsapp_message || '');
  const [isScheduled, setIsScheduled] = useState(!!client?.scheduled_at);
  const [scheduledDate, setScheduledDate] = useState(client?.scheduled_at ? format(parseISO(client.scheduled_at), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"));
  const [scheduledTime, setScheduledTime] = useState(client?.scheduled_at ? format(parseISO(client.scheduled_at), "HH:mm") : "09:00");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      phone,
      description,
      whatsapp_message: whatsappMessage,
      scheduled_at: isScheduled ? `${scheduledDate}T${scheduledTime}:00` : null,
      status: client?.status || 'pending'
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="text-xl font-bold">{client ? 'Editar Cliente' : 'Novo Cliente'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1.5">Nome Completo</label>
              <Input required value={name} onChange={(e: any) => setName(e.target.value)} placeholder="Ex: João Silva" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1.5">Telefone (WhatsApp)</label>
              <Input required value={phone} onChange={(e: any) => setPhone(e.target.value)} placeholder="Ex: 11999999999" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1.5">Descrição / Observações</label>
              <Textarea value={description} onChange={(e: any) => setDescription(e.target.value)} placeholder="Detalhes do interesse, modelo da moto, etc." />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1.5">Mensagem WhatsApp Padrão</label>
              <Textarea value={whatsappMessage} onChange={(e: any) => setWhatsappMessage(e.target.value)} placeholder="Mensagem que será enviada ao clicar no ícone do WhatsApp." />
            </div>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-zinc-800/50 rounded-xl border border-gray-100 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-4">
              <label className="font-medium flex items-center gap-2">
                <CalendarIcon size={18} className="text-blue-600" />
                Agendar Atendimento
              </label>
              <button 
                type="button"
                onClick={() => setIsScheduled(!isScheduled)}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  isScheduled ? "bg-blue-600" : "bg-gray-300 dark:bg-zinc-700"
                )}
              >
                <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white transition-transform", isScheduled ? "translate-x-6" : "translate-x-1")} />
              </button>
            </div>

            {isScheduled && (
              <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <div>
                  <label className="block text-xs font-medium mb-1 text-gray-500">Data</label>
                  <Input type="date" value={scheduledDate} onChange={(e: any) => setScheduledDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-gray-500">Horário</label>
                  <Input type="time" value={scheduledTime} onChange={(e: any) => setScheduledTime(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="flex-1">Salvar Cliente</Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function AdminPanel({ sellers, onAddSeller, onToggleActive }: { sellers: User[], onAddSeller: (n: string, e: string) => void, onToggleActive: (id: number, a: boolean) => void }) {
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Gerenciar Vendedores</h2>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-bold mb-4">Cadastrar Novo Vendedor</h3>
        <form onSubmit={(e) => { e.preventDefault(); onAddSeller(newName, newEmail); setNewName(''); setNewEmail(''); }} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input placeholder="Nome" required value={newName} onChange={(e: any) => setNewName(e.target.value)} />
          <Input placeholder="E-mail" type="email" required value={newEmail} onChange={(e: any) => setNewEmail(e.target.value)} />
          <Button type="submit">Adicionar Vendedor</Button>
        </form>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sellers.map(seller => (
          <Card key={seller.id} className="p-5">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-xl font-bold">
                {seller.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold truncate">{seller.name}</h4>
                <p className="text-sm text-gray-500 truncate">{seller.email}</p>
              </div>
              <div className={cn("w-2.5 h-2.5 rounded-full", seller.active ? "bg-emerald-500" : "bg-red-500")} />
            </div>
            <div className="flex gap-2">
              <Button 
                variant={seller.active ? "outline" : "primary"} 
                className="flex-1 text-sm"
                onClick={() => onToggleActive(seller.id, !seller.active)}
              >
                {seller.active ? "Desativar" : "Ativar"}
              </Button>
              {seller.role === 'admin' && (
                <span className="px-3 py-2 text-xs font-bold uppercase tracking-widest text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 rounded-lg flex items-center">Admin</span>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function WeekSelector({ selectedDate, onSelect }: { selectedDate: Date, onSelect: (d: Date) => void }) {
  const start = startOfWeek(new Date(), { weekStartsOn: 0 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  return (
    <div className="flex items-center justify-center gap-2 overflow-x-auto py-2 px-4 no-scrollbar">
      {days.map(day => {
        const active = isSameDay(day, selectedDate);
        return (
          <button 
            key={day.toISOString()}
            onClick={() => onSelect(day)}
            className={cn(
              "flex flex-col items-center min-w-[64px] p-3 rounded-2xl transition-all",
              active 
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30 scale-110" 
                : "bg-white dark:bg-zinc-900 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800"
            )}
          >
            <span className="text-[10px] uppercase font-bold opacity-70 mb-1">{format(day, "EEE", { locale: ptBR })}</span>
            <span className="text-lg font-bold">{format(day, "dd")}</span>
            {isToday(day) && !active && <div className="w-1 h-1 bg-blue-600 rounded-full mt-1" />}
          </button>
        );
      })}
    </div>
  );
}

function MonthCalendar({ selectedDate, onSelect, clients }: { selectedDate: Date, onSelect: (d: Date) => void, clients: Client[] }) {
  const [viewDate, setViewDate] = useState(selectedDate);
  const start = startOfMonth(viewDate);
  const end = endOfMonth(viewDate);
  const monthStart = startOfWeek(start, { weekStartsOn: 0 });
  const monthEnd = endOfWeek(end, { weekStartsOn: 0 });
  
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getDayStatus = (day: Date) => {
    const dayClients = clients.filter(c => c.scheduled_at && isSameDay(parseISO(c.scheduled_at), day));
    if (dayClients.length === 0) return null;
    const hasOverdue = dayClients.some(c => c.status === 'pending' && isBefore(parseISO(c.scheduled_at!), new Date()));
    return hasOverdue ? 'overdue' : 'ontime';
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 p-4 shadow-sm max-w-md mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-bold text-lg capitalize">{format(viewDate, "MMMM yyyy", { locale: ptBR })}</h3>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => setViewDate(subMonths(viewDate, 1))}><ChevronLeft size={20} /></Button>
          <Button variant="ghost" size="icon" onClick={() => setViewDate(addMonths(viewDate, 1))}><ChevronRight size={20} /></Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(d => (
          <div key={d} className="text-center text-[10px] font-bold text-gray-400 py-2">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map(day => {
          const active = isSameDay(day, selectedDate);
          const isCurrentMonth = isSameMonth(day, viewDate);
          const status = getDayStatus(day);
          
          return (
            <button 
              key={day.toISOString()}
              onClick={() => onSelect(day)}
              className={cn(
                "aspect-square flex flex-col items-center justify-center rounded-xl transition-all relative",
                !isCurrentMonth && "opacity-20",
                active 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" 
                  : "hover:bg-gray-100 dark:hover:bg-zinc-800",
                isToday(day) && !active && "text-blue-600 font-bold"
              )}
            >
              <span className="text-sm font-medium">{format(day, "d")}</span>
              {status && (
                <div className={cn(
                  "absolute bottom-1.5 w-1 h-1 rounded-full",
                  status === 'overdue' ? "bg-red-500" : "bg-blue-500",
                  active && "bg-white"
                )} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
