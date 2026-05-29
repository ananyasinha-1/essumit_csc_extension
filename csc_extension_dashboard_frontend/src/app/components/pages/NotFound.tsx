import { useNavigate } from 'react-router';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import { ErrorOutline, ArrowBack } from '@mui/icons-material';
import { alpha } from '@mui/material/styles';

const GOV = {
  navy:    '#0c2461',
  blue:    '#1a4592',
  saffron: '#FF9933',
  green:   '#138808',
  white:   '#ffffff',
};

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minHeight: '100%', pt: 8 }}>
      
      {/* 404 Badge & Icon */}
      <Box sx={{ textAlign: 'center', maxWidth: 600 }}>
        <Box sx={{ 
          display: 'inline-flex', alignItems: 'center', gap: 1, 
          bgcolor: alpha(GOV.saffron, 0.1), color: '#d97706', 
          px: 2, py: 0.5, borderRadius: '16px', mb: 2, 
          border: `1px solid ${alpha(GOV.saffron, 0.3)}`,
          fontSize: '13px', fontWeight: 600
        }}>
          <ErrorOutline sx={{ fontSize: 16 }} />
          404 Not Found
        </Box>
        <Typography variant="h2" sx={{ fontWeight: 800, color: GOV.navy, mb: 1, fontFamily: 'Inter, sans-serif' }}>
          Page Not Found
        </Typography>
        <Typography sx={{ color: '#6b7280', fontSize: '15px' }}>
          The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
        </Typography>
      </Box>

      {/* Info Card */}
      <Paper elevation={0} sx={{ 
        width: '100%', maxWidth: 450, 
        border: `1px solid ${alpha(GOV.blue, 0.15)}`, 
        borderRadius: 2, p: 3, textAlign: 'center'
      }}>
        <Typography sx={{ fontWeight: 600, color: GOV.navy, fontSize: '16px', mb: 1 }}>
          Looking for Dashboard Statistics?
        </Typography>
        <Typography sx={{ color: '#6b7280', fontSize: '13px', lineHeight: 1.5 }}>
          If you are looking for operators, analytics, or service logs, please return to the main dashboard workspace.
        </Typography>
      </Paper>

      {/* Action */}
      <Button 
        variant="contained" 
        onClick={() => navigate('/')}
        startIcon={<ArrowBack />}
        sx={{ 
          bgcolor: GOV.blue, 
          '&:hover': { bgcolor: GOV.navy },
          textTransform: 'none',
          px: 3, py: 1, borderRadius: 2
        }}
      >
        Go to Home
      </Button>

    </Box>
  );
}
