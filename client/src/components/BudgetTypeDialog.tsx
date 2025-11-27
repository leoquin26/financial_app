import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Card,
  CardContent,
  Typography,
  Box,
  RadioGroup,
  FormControlLabel,
  Radio,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  CalendarViewWeek as WeekIcon,
  CalendarMonth as MonthIcon,
  TrendingUp,
  AccountBalance,
} from '@mui/icons-material';

interface BudgetTypeDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (type: 'weekly' | 'monthly') => void;
}

const BudgetTypeDialog: React.FC<BudgetTypeDialogProps> = ({ open, onClose, onSelect }) => {
  const [selectedType, setSelectedType] = useState<'weekly' | 'monthly'>('weekly');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleConfirm = () => {
    onSelect(selectedType);
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      className="budget-type-dialog"
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={2}>
          <AccountBalance color="primary" />
          <Typography variant="h6">Elige el tipo de presupuesto</Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          ¿Cómo prefieres organizar tu presupuesto para este mes?
        </Typography>

        <RadioGroup
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as 'weekly' | 'monthly')}
        >
          <Card 
            sx={{ 
              mb: 2, 
              cursor: 'pointer',
              border: selectedType === 'weekly' ? 2 : 1,
              borderColor: selectedType === 'weekly' ? 'primary.main' : 'divider',
              transition: 'all 0.2s'
            }}
            onClick={() => setSelectedType('weekly')}
          >
            <CardContent>
              <FormControlLabel
                value="weekly"
                control={<Radio />}
                label={
                  <Box>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <WeekIcon color={selectedType === 'weekly' ? 'primary' : 'action'} />
                      <Typography variant="h6">
                        Presupuesto Semanal
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Divide tu mes en semanas completas (Lunes a Domingo)
                    </Typography>
                    <Typography variant="caption" color="info.main" sx={{ display: 'block', mt: 0.5 }}>
                      Se crearán presupuestos para todas las semanas del mes
                    </Typography>
                    <Box mt={1}>
                      <Typography variant="caption" color="success.main">
                        ✓ Mayor control de gastos
                      </Typography>
                      <br />
                      <Typography variant="caption" color="success.main">
                        ✓ Ajustes semanales flexibles
                      </Typography>
                      <br />
                      <Typography variant="caption" color="success.main">
                        ✓ Ideal para ingresos variables
                      </Typography>
                    </Box>
                  </Box>
                }
                sx={{ width: '100%' }}
              />
            </CardContent>
          </Card>

          <Card 
            sx={{ 
              cursor: 'pointer',
              border: selectedType === 'monthly' ? 2 : 1,
              borderColor: selectedType === 'monthly' ? 'primary.main' : 'divider',
              transition: 'all 0.2s'
            }}
            onClick={() => setSelectedType('monthly')}
          >
            <CardContent>
              <FormControlLabel
                value="monthly"
                control={<Radio />}
                label={
                  <Box>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <MonthIcon color={selectedType === 'monthly' ? 'primary' : 'action'} />
                      <Typography variant="h6">
                        Presupuesto Mensual Completo
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Un solo presupuesto para todo el mes
                    </Typography>
                    <Box mt={1}>
                      <Typography variant="caption" color="success.main">
                        ✓ Visión general del mes
                      </Typography>
                      <br />
                      <Typography variant="caption" color="success.main">
                        ✓ Planificación simplificada
                      </Typography>
                      <br />
                      <Typography variant="caption" color="success.main">
                        ✓ Ideal para ingresos fijos
                      </Typography>
                    </Box>
                  </Box>
                }
                sx={{ width: '100%' }}
              />
            </CardContent>
          </Card>
        </RadioGroup>

        <Box 
          sx={{ 
            mt: 3, 
            p: 2, 
            bgcolor: 'info.light',
            borderRadius: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}
        >
          <TrendingUp color="info" />
          <Typography variant="caption">
            {selectedType === 'weekly' 
              ? 'Podrás ajustar el presupuesto cada semana según tus necesidades'
              : 'Tendrás una visión completa de tus gastos mensuales en un solo lugar'}
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} color="inherit">
          Cancelar
        </Button>
        <Button 
          onClick={handleConfirm} 
          variant="contained"
          startIcon={selectedType === 'weekly' ? <WeekIcon /> : <MonthIcon />}
        >
          Crear Presupuesto {selectedType === 'weekly' ? 'Semanal' : 'Mensual'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BudgetTypeDialog;
