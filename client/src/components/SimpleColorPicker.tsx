import React from 'react';
import { Box, TextField, Grid } from '@mui/material';

interface SimpleColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  presetColors?: string[];
}

const DEFAULT_COLORS = [
  '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
  '#FF9F40', '#4CAF50', '#F44336', '#E91E63', '#9C27B0',
  '#673AB7', '#3F51B5', '#2196F3', '#00BCD4', '#009688',
  '#8BC34A', '#CDDC39', '#FFC107', '#FF9800', '#FF5722',
  '#795548', '#607D8B', '#78909C', '#37474F', '#263238',
];

const SimpleColorPicker: React.FC<SimpleColorPickerProps> = ({ 
  color, 
  onChange, 
  presetColors = DEFAULT_COLORS 
}) => {
  return (
    <Box>
      <Grid container spacing={1} sx={{ mb: 2 }}>
        {presetColors.map((presetColor) => (
          <Grid item key={presetColor}>
            <Box
              onClick={() => onChange(presetColor)}
              sx={{
                width: 40,
                height: 40,
                backgroundColor: presetColor,
                border: '2px solid',
                borderColor: color === presetColor ? 'primary.main' : 'divider',
                borderRadius: 1,
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  transform: 'scale(1.1)',
                  boxShadow: 2,
                },
              }}
            />
          </Grid>
        ))}
      </Grid>
      <TextField
        fullWidth
        type="color"
        value={color}
        onChange={(e) => onChange(e.target.value)}
        label="Color personalizado"
        InputProps={{
          sx: {
            '& input[type="color"]': {
              width: '100%',
              height: 40,
              cursor: 'pointer',
              border: 'none',
              borderRadius: 1,
            },
          },
        }}
      />
    </Box>
  );
};

export default SimpleColorPicker;
