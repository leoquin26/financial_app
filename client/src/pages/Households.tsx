import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Avatar,
  AvatarGroup,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Paper,
  Alert,
  Skeleton,
  Menu,
  MenuItem,
  Switch,
  FormControlLabel,
  FormGroup,
  Tabs,
  Tab,
  Badge,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Home as HomeIcon,
  People as PeopleIcon,
  PersonAdd as PersonAddIcon,
  Settings as SettingsIcon,
  ExitToApp as ExitIcon,
  MoreVert as MoreVertIcon,
  Email as EmailIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  AdminPanelSettings,
  Share as ShareIcon,
  AccountBalance,
  Category,
  TrendingUp,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { axiosInstance as axios } from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Household {
  _id: string;
  name: string;
  description?: string;
  createdBy: {
    _id: string;
    username: string;
    email: string;
  };
  members: Array<{
    user: {
      _id: string;
      username: string;
      email: string;
    };
    role: 'owner' | 'admin' | 'member' | 'viewer';
    joinedAt: Date;
    permissions: {
      canAddTransactions: boolean;
      canEditTransactions: boolean;
      canDeleteTransactions: boolean;
      canManageBudgets: boolean;
      canManageCategories: boolean;
      canInviteMembers: boolean;
      canViewAnalytics: boolean;
    };
  }>;
  settings: {
    currency: string;
    shareAllTransactions: boolean;
    shareCategories: boolean;
    shareBudgets: boolean;
  };
  stats?: {
    transactions: number;
    categories: number;
    budgets: number;
  };
  createdAt: Date;
}

interface Invitation {
  _id: string;
  household: {
    _id: string;
    name: string;
    description?: string;
  };
  invitedBy: {
    username: string;
    email: string;
  };
  role: string;
  message?: string;
  token: string;
  createdAt: Date;
}

interface HouseholdForm {
  name: string;
  description: string;
}

interface InviteForm {
  email: string;
  role: 'admin' | 'member' | 'viewer';
  message: string;
}

const Households: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();
  const [tabValue, setTabValue] = useState(0);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [selectedHousehold, setSelectedHousehold] = useState<Household | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedMember, setSelectedMember] = useState<any>(null);

  // Form controllers
  const { control: createControl, handleSubmit: handleCreateSubmit, reset: resetCreate, formState: { errors: createErrors } } = useForm<HouseholdForm>({
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const { control: inviteControl, handleSubmit: handleInviteSubmit, reset: resetInvite, formState: { errors: inviteErrors } } = useForm<InviteForm>({
    defaultValues: {
      email: '',
      role: 'member',
      message: '',
    },
  });

  // Queries
  const { data: households, isLoading: loadingHouseholds } = useQuery<Household[]>({
    queryKey: ['households'],
    queryFn: async () => {
      const response = await axios.get('/api/households');
      return response.data;
    },
  });

  const { data: invitations, isLoading: loadingInvitations } = useQuery<Invitation[]>({
    queryKey: ['invitations'],
    queryFn: async () => {
      const response = await axios.get('/api/households/invitations/my');
      return response.data;
    },
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: HouseholdForm) => {
      const response = await axios.post('/api/households', data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Hogar creado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['households'] });
      setCreateDialogOpen(false);
      resetCreate();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al crear hogar');
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async ({ householdId, data }: { householdId: string; data: InviteForm }) => {
      const response = await axios.post(`/api/households/${householdId}/invite`, data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Invitación enviada exitosamente');
      setInviteDialogOpen(false);
      resetInvite();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al enviar invitación');
    },
  });

  const acceptInvitationMutation = useMutation({
    mutationFn: async (invitation: Invitation) => {
      const response = await axios.post(`/api/households/invitations/${invitation.token}/accept`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Te has unido al hogar exitosamente');
      queryClient.invalidateQueries({ queryKey: ['households'] });
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
    },
    onError: (error: any) => {
      // Only show error if it's a real error, not a false positive
      if (error.response?.status !== 200) {
        toast.error(error.response?.data?.error || 'Error al aceptar invitación');
      }
    },
  });

  const rejectInvitationMutation = useMutation({
    mutationFn: async (invitation: Invitation) => {
      const response = await axios.post(`/api/households/invitations/${invitation.token}/reject`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Invitación rechazada');
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al rechazar invitación');
    },
  });

  const leaveHouseholdMutation = useMutation({
    mutationFn: async (householdId: string) => {
      const response = await axios.post(`/api/households/${householdId}/leave`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Has salido del hogar');
      queryClient.invalidateQueries({ queryKey: ['households'] });
    },
    onError: (error: any) => {
      // Only show error if it's a real error
      if (error.response?.status !== 200) {
        toast.error(error.response?.data?.error || 'Error al salir del hogar');
      }
    },
  });

  // Real-time socket event listeners
  useEffect(() => {
    if (!socket) return;

    // Listen for new invitations
    socket.on('new-invitation', (data) => {
      toast('📨 Nueva invitación recibida', { icon: '🎉' });
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
    });

    // Listen for invitation accepted
    socket.on('invitation-accepted', (data) => {
      toast.success(`✅ ${data.acceptedBy.username} ha aceptado tu invitación al hogar "${data.householdName}"`);
      queryClient.invalidateQueries({ queryKey: ['households'] });
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
    });

    // Listen for invitation rejected
    socket.on('invitation-rejected', (data) => {
      toast(`❌ ${data.rejectedBy.username} ha rechazado tu invitación`, { icon: '😔' });
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
    });

    // Listen for invitation sent (for household members)
    socket.on('invitation-sent', (data) => {
      if (data.sentBy !== user?.id) {
        toast(`📤 Se ha enviado una invitación a ${data.invitedEmail}`, { icon: '📧' });
      }
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
    });

    // Listen for new member joined
    socket.on('member-joined', (data) => {
      toast.success(`🎊 ${data.newMember.username} se ha unido al hogar "${data.householdName}"`);
      queryClient.invalidateQueries({ queryKey: ['households'] });
    });

    // Listen for member left
    socket.on('member-left', (data) => {
      toast(`👋 Un miembro ha salido del hogar`, { icon: '😢' });
      queryClient.invalidateQueries({ queryKey: ['households'] });
    });

    // Listen for general invitation updates
    socket.on('invitations-updated', () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      queryClient.invalidateQueries({ queryKey: ['households'] });
    });

    // Cleanup listeners on unmount
    return () => {
      socket.off('new-invitation');
      socket.off('invitation-accepted');
      socket.off('invitation-rejected');
      socket.off('invitation-sent');
      socket.off('member-joined');
      socket.off('member-left');
      socket.off('invitations-updated');
    };
  }, [socket, queryClient, user]);

  const handleCreateHousehold = (data: HouseholdForm) => {
    createMutation.mutate({
      ...data,
      settings: {
        currency: 'PEN',
        shareAllTransactions: true,
        shareCategories: true,
        shareBudgets: true,
      }
    } as any);
  };

  const handleInviteMember = (data: InviteForm) => {
    if (selectedHousehold) {
      inviteMutation.mutate({
        householdId: selectedHousehold._id,
        data,
      });
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, household: Household) => {
    setAnchorEl(event.currentTarget);
    setSelectedHousehold(household);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const getUserRole = (household: Household) => {
    const member = household.members.find(m => m.user._id === user?.id?.toString());
    return member?.role || 'member';
  };

  const canInvite = (household: Household) => {
    const member = household.members.find(m => m.user._id === user?.id?.toString());
    return member?.role === 'owner' || member?.role === 'admin' || member?.permissions.canInviteMembers;
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'error';
      case 'admin':
        return 'warning';
      case 'viewer':
        return 'info';
      default:
        return 'default';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
      case 'admin':
        return <AdminPanelSettings fontSize="small" />;
      default:
        return undefined;
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">
          Hogares Compartidos
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          Crear Hogar
        </Button>
      </Box>

      {/* Tabs */}
      <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ mb: 3 }}>
        <Tab 
          label="Mis Hogares" 
          icon={<Badge badgeContent={households?.length || 0} color="primary"><HomeIcon /></Badge>} 
          iconPosition="start" 
        />
        <Tab 
          label="Invitaciones" 
          icon={<Badge badgeContent={invitations?.length || 0} color="error"><EmailIcon /></Badge>} 
          iconPosition="start" 
        />
      </Tabs>

      {/* My Households */}
      {tabValue === 0 && (
        <Grid container spacing={3}>
          {loadingHouseholds ? (
            [1, 2, 3].map((i) => (
              <Grid item xs={12} md={6} lg={4} key={i}>
                <Skeleton variant="rectangular" height={250} />
              </Grid>
            ))
          ) : households && households.length > 0 ? (
            households.map((household) => (
              <Grid item xs={12} md={6} lg={4} key={household._id}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <CardContent sx={{ flex: 1 }}>
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <HomeIcon color="primary" />
                          <Typography variant="h6" fontWeight="bold">
                            {household.name}
                          </Typography>
                        </Box>
                        <IconButton size="small" onClick={(e) => handleMenuOpen(e, household)}>
                          <MoreVertIcon />
                        </IconButton>
                      </Box>
                      
                      {household.description && (
                        <Typography variant="body2" color="textSecondary" mb={2}>
                          {household.description}
                        </Typography>
                      )}

                      <Box mb={2}>
                        <Typography variant="caption" color="textSecondary" gutterBottom>
                          Miembros ({household.members.length})
                        </Typography>
                        <AvatarGroup max={4} sx={{ justifyContent: 'flex-start', mt: 1 }}>
                          {household.members.map((member) => (
                            <Tooltip key={member.user._id} title={`${member.user.username} (${member.role})`}>
                              <Avatar sx={{ width: 32, height: 32 }}>
                                {member.user.username[0].toUpperCase()}
                              </Avatar>
                            </Tooltip>
                          ))}
                        </AvatarGroup>
                      </Box>

                      {household.stats && (
                        <Box display="flex" gap={2} flexWrap="wrap">
                          <Chip
                            size="small"
                            icon={<AccountBalance />}
                            label={`${household.stats.transactions} transacciones`}
                            variant="outlined"
                          />
                          <Chip
                            size="small"
                            icon={<Category />}
                            label={`${household.stats.categories} categorías`}
                            variant="outlined"
                          />
                          <Chip
                            size="small"
                            icon={<TrendingUp />}
                            label={`${household.stats.budgets} presupuestos`}
                            variant="outlined"
                          />
                        </Box>
                      )}

                      <Box mt={2}>
                        <Chip
                          label={getUserRole(household)}
                          size="small"
                          color={getRoleColor(getUserRole(household))}
                          icon={getRoleIcon(getUserRole(household))}
                        />
                      </Box>
                    </CardContent>
                    
                    <CardActions>
                      <Button
                        size="small"
                        onClick={() => navigate(`/households/${household._id}`)}
                      >
                        Ver Detalles
                      </Button>
                      {canInvite(household) && (
                        <Button
                          size="small"
                          startIcon={<PersonAddIcon />}
                          onClick={() => {
                            setSelectedHousehold(household);
                            setInviteDialogOpen(true);
                          }}
                        >
                          Invitar
                        </Button>
                      )}
                    </CardActions>
                  </Card>
                </motion.div>
              </Grid>
            ))
          ) : (
            <Grid item xs={12}>
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <HomeIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  No tienes hogares compartidos
                </Typography>
                <Typography variant="body2" color="textSecondary" mb={2}>
                  Crea un hogar para compartir gastos con tu familia o compañeros
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setCreateDialogOpen(true)}
                >
                  Crear tu primer hogar
                </Button>
              </Paper>
            </Grid>
          )}
        </Grid>
      )}

      {/* Invitations */}
      {tabValue === 1 && (
        <Box>
          {loadingInvitations ? (
            <Skeleton variant="rectangular" height={200} />
          ) : invitations && invitations.length > 0 ? (
            <List>
              {invitations.map((invitation) => (
                <Paper key={invitation._id} sx={{ mb: 2 }}>
                  <ListItem>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'primary.main' }}>
                        <EmailIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="subtitle1" fontWeight="bold">
                            Invitación a {invitation.household.name}
                          </Typography>
                          <Chip
                            label={invitation.role}
                            size="small"
                            color={getRoleColor(invitation.role)}
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          {invitation.household.description && (
                            <Typography variant="body2" color="textSecondary">
                              {invitation.household.description}
                            </Typography>
                          )}
                          <Typography variant="caption" color="textSecondary">
                            Invitado por {invitation.invitedBy.username} • {' '}
                            {format(new Date(invitation.createdAt), 'dd MMM yyyy', { locale: es })}
                          </Typography>
                          {invitation.message && (
                            <Alert severity="info" sx={{ mt: 1 }}>
                              {invitation.message}
                            </Alert>
                          )}
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        color="success"
                        onClick={() => acceptInvitationMutation.mutate(invitation)}
                        sx={{ mr: 1 }}
                      >
                        <CheckIcon />
                      </IconButton>
                      <IconButton 
                        edge="end" 
                        color="error"
                        onClick={() => rejectInvitationMutation.mutate(invitation)}
                      >
                        <CloseIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                </Paper>
              ))}
            </List>
          ) : (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <EmailIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                No tienes invitaciones pendientes
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Cuando alguien te invite a un hogar, aparecerá aquí
              </Typography>
            </Paper>
          )}
        </Box>
      )}

      {/* Create Household Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleCreateSubmit(handleCreateHousehold)}>
          <DialogTitle>
            <Box display="flex" alignItems="center" gap={1}>
              <HomeIcon color="primary" />
              Crear Nuevo Hogar
            </Box>
          </DialogTitle>
          <DialogContent>
            <Box display="flex" flexDirection="column" gap={2} mt={1}>
              <Controller
                name="name"
                control={createControl}
                rules={{ required: 'El nombre es requerido' }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Nombre del Hogar"
                    fullWidth
                    error={!!createErrors.name}
                    helperText={createErrors.name?.message}
                    placeholder="Ej: Casa Familiar, Departamento Compartido"
                  />
                )}
              />
              <Controller
                name="description"
                control={createControl}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Descripción (Opcional)"
                    fullWidth
                    multiline
                    rows={3}
                    placeholder="Describe el propósito de este hogar compartido"
                  />
                )}
              />
              <Alert severity="info">
                Como creador, serás el propietario del hogar y podrás invitar a otros miembros
              </Alert>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateDialogOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={createMutation.isPending}>
              Crear Hogar
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Invite Member Dialog */}
      <Dialog open={inviteDialogOpen} onClose={() => setInviteDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleInviteSubmit(handleInviteMember)}>
          <DialogTitle>
            <Box display="flex" alignItems="center" gap={1}>
              <PersonAddIcon color="primary" />
              Invitar Miembro
            </Box>
          </DialogTitle>
          <DialogContent>
            <Box display="flex" flexDirection="column" gap={2} mt={1}>
              <Controller
                name="email"
                control={inviteControl}
                rules={{ 
                  required: 'El email es requerido',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Email inválido'
                  }
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Email del invitado"
                    fullWidth
                    type="email"
                    error={!!inviteErrors.email}
                    helperText={inviteErrors.email?.message}
                    placeholder="ejemplo@email.com"
                  />
                )}
              />
              <Controller
                name="role"
                control={inviteControl}
                render={({ field }) => (
                  <TextField
                    {...field}
                    select
                    label="Rol"
                    fullWidth
                  >
                    <MenuItem value="admin">Administrador</MenuItem>
                    <MenuItem value="member">Miembro</MenuItem>
                    <MenuItem value="viewer">Observador</MenuItem>
                  </TextField>
                )}
              />
              <Controller
                name="message"
                control={inviteControl}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Mensaje (Opcional)"
                    fullWidth
                    multiline
                    rows={3}
                    placeholder="Añade un mensaje personal a la invitación"
                  />
                )}
              />
              <Alert severity="info">
                El usuario recibirá una invitación por email y notificación en la app
              </Alert>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setInviteDialogOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={inviteMutation.isPending}>
              Enviar Invitación
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Household Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => {
          if (selectedHousehold) {
            navigate(`/households/${selectedHousehold._id}/settings`);
          }
          handleMenuClose();
        }}>
          <ListItemAvatar>
            <SettingsIcon fontSize="small" />
          </ListItemAvatar>
          Configuración
        </MenuItem>
        <Divider />
        <MenuItem 
          onClick={() => {
            if (selectedHousehold) {
              if (window.confirm('¿Estás seguro de que quieres salir de este hogar?')) {
                leaveHouseholdMutation.mutate(selectedHousehold._id);
              }
            }
            handleMenuClose();
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemAvatar>
            <ExitIcon fontSize="small" />
          </ListItemAvatar>
          Salir del Hogar
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default Households;
