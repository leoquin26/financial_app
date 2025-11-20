import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { ThemeProvider, createTheme, CssBaseline, PaletteMode, useMediaQuery } from '@mui/material';
import { useAuth } from './AuthContext';
import { useQuery } from '@tanstack/react-query';
import { axiosInstance as axios } from '../config/api';

interface ThemeContextType {
  mode: PaletteMode;
  themePreference: 'light' | 'dark' | 'auto';
  setThemePreference: (preference: 'light' | 'dark' | 'auto') => void;
  density: 'compact' | 'comfortable' | 'spacious';
  setDensity: (density: 'compact' | 'comfortable' | 'spacious') => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface CustomThemeProviderProps {
  children: ReactNode;
}

export const CustomThemeProvider: React.FC<CustomThemeProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const [themePreference, setThemePreference] = useState<'light' | 'dark' | 'auto'>('light');
  const [density, setDensity] = useState<'compact' | 'comfortable' | 'spacious'>('comfortable');

  // Fetch user settings including theme preference
  const { data: userSettings } = useQuery({
    queryKey: ['user-settings'],
    queryFn: async () => {
      const response = await axios.get('/api/auth/settings');
      return response.data;
    },
    enabled: !!user,
  });

  // Update theme preference and density when user settings change
  useEffect(() => {
    if (userSettings?.theme) {
      setThemePreference(userSettings.theme);
    }
    if (userSettings?.preferences?.density) {
      setDensity(userSettings.preferences.density);
    }
  }, [userSettings?.theme, userSettings?.preferences?.density]);

  // Determine the actual mode based on preference
  const mode: PaletteMode = useMemo(() => {
    if (themePreference === 'auto') {
      return prefersDarkMode ? 'dark' : 'light';
    }
    return themePreference;
  }, [themePreference, prefersDarkMode]);

  // Get density values
  const densityConfig = {
    compact: {
      spacing: 6,
      buttonPadding: '6px 12px',
      fontSize: '0.875rem',
      iconSize: 20,
    },
    comfortable: {
      spacing: 8,
      buttonPadding: '10px 20px',
      fontSize: '1rem',
      iconSize: 24,
    },
    spacious: {
      spacing: 10,
      buttonPadding: '14px 28px',
      fontSize: '1.125rem',
      iconSize: 28,
    },
  };

  const currentDensity = densityConfig[density];

  // Create the theme based on the mode and density
  const theme = useMemo(
    () =>
      createTheme({
        spacing: currentDensity.spacing,
        palette: {
          mode,
          ...(mode === 'light'
            ? {
                // Light mode colors
                primary: {
                  main: '#4A90E2',
                  light: '#6BA3E5',
                  dark: '#3A7BC8',
                },
                secondary: {
                  main: '#50C878',
                  light: '#7FD99A',
                  dark: '#3BA55D',
                },
                error: {
                  main: '#FF6B6B',
                  light: '#FF9999',
                  dark: '#CC5555',
                },
                warning: {
                  main: '#FFD93D',
                  light: '#FFE066',
                  dark: '#CCAE31',
                },
                success: {
                  main: '#4CAF50',
                  light: '#7BC67E',
                  dark: '#3D8B40',
                },
                background: {
                  default: '#F5F7FA',
                  paper: '#FFFFFF',
                },
                text: {
                  primary: '#2C3E50',
                  secondary: '#7F8C8D',
                },
              }
            : {
                // Dark mode colors
                primary: {
                  main: '#6BA3E5',
                  light: '#8BB6E8',
                  dark: '#4A90E2',
                },
                secondary: {
                  main: '#7FD99A',
                  light: '#9FE3B6',
                  dark: '#50C878',
                },
                error: {
                  main: '#FF9999',
                  light: '#FFB3B3',
                  dark: '#FF6B6B',
                },
                warning: {
                  main: '#FFE066',
                  light: '#FFE880',
                  dark: '#FFD93D',
                },
                success: {
                  main: '#7BC67E',
                  light: '#95D398',
                  dark: '#4CAF50',
                },
                background: {
                  default: '#121212',
                  paper: '#1E1E1E',
                },
                text: {
                  primary: '#FFFFFF',
                  secondary: '#B0B0B0',
                },
              }),
        },
        typography: {
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          h1: {
            fontSize: '2.5rem',
            fontWeight: 600,
          },
          h2: {
            fontSize: '2rem',
            fontWeight: 600,
          },
          h3: {
            fontSize: '1.75rem',
            fontWeight: 600,
          },
          h4: {
            fontSize: '1.5rem',
            fontWeight: 600,
          },
          h5: {
            fontSize: '1.25rem',
            fontWeight: 600,
          },
          h6: {
            fontSize: '1rem',
            fontWeight: 600,
          },
        },
        shape: {
          borderRadius: 12,
        },
        components: {
          MuiButton: {
            styleOverrides: {
              root: {
                textTransform: 'none',
                borderRadius: 8,
                padding: currentDensity.buttonPadding,
                fontSize: currentDensity.fontSize,
                fontWeight: 500,
              },
            },
          },
          MuiCard: {
            styleOverrides: {
              root: {
                borderRadius: 12,
                boxShadow: mode === 'light' 
                  ? '0 2px 8px rgba(0,0,0,0.1)'
                  : '0 2px 8px rgba(0,0,0,0.3)',
              },
            },
          },
          MuiTextField: {
            styleOverrides: {
              root: {
                '& .MuiOutlinedInput-root': {
                  borderRadius: 8,
                },
              },
            },
          },
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundImage: 'none',
              },
            },
          },
          MuiListItem: {
            styleOverrides: {
              root: {
                paddingTop: currentDensity.spacing,
                paddingBottom: currentDensity.spacing,
              },
            },
          },
          MuiTableCell: {
            styleOverrides: {
              root: {
                padding: density === 'compact' ? '8px' : density === 'spacious' ? '20px' : '16px',
              },
            },
          },
          MuiIconButton: {
            styleOverrides: {
              root: {
                padding: currentDensity.spacing,
                '& .MuiSvgIcon-root': {
                  fontSize: currentDensity.iconSize,
                },
              },
            },
          },
          MuiFormControl: {
            styleOverrides: {
              root: {
                marginBottom: currentDensity.spacing * 2,
              },
            },
          },
        },
      }),
    [mode, density, currentDensity]
  );

  const contextValue = {
    mode,
    themePreference,
    setThemePreference,
    density,
    setDensity,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeContext.Provider>
  );
};

export default CustomThemeProvider;
