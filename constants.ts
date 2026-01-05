import { Team } from './types';

export const TEAMS: Team[] = [
  { id: 'atalanta', name: 'Atalanta', colors: ['#1E71B8', '#000000'] },
  { id: 'bologna', name: 'Bologna', colors: ['#1A2F48', '#A21C26'] },
  { id: 'cremonese', name: 'Cremonese', colors: ['#989898', '#A91018'] },
  { id: 'empoli', name: 'Empoli', colors: ['#00579C', '#FFFFFF'] },
  { id: 'fiorentina', name: 'Fiorentina', colors: ['#482E92', '#FFFFFF'] },
  { id: 'inter', name: 'Inter', colors: ['#0068A8', '#000000'] },
  { id: 'juventus', name: 'Juventus', colors: ['#000000', '#FFFFFF'] },
  { id: 'lazio', name: 'Lazio', colors: ['#87D8F7', '#FFFFFF'] },
  { id: 'lecce', name: 'Lecce', colors: ['#F7D800', '#DA291C'] },
  { id: 'milan', name: 'Milan', colors: ['#FB090B', '#000000'] },
  { id: 'monza', name: 'Monza', colors: ['#E30613', '#FFFFFF'] },
  { id: 'napoli', name: 'Napoli', colors: ['#0067B3', '#FFFFFF'] },
  { id: 'roma', name: 'Roma', colors: ['#8B0304', '#F6A323'] },
  { id: 'salernitana', name: 'Salernitana', colors: ['#8A1E41', '#FFFFFF'] },
  { id: 'sampdoria', name: 'Sampdoria', colors: ['#1B5497', '#FFFFFF'] },
  { id: 'sassuolo', name: 'Sassuolo', colors: ['#00A752', '#000000'] },
  { id: 'spezia', name: 'Spezia', colors: ['#000000', '#FFFFFF'] },
  { id: 'torino', name: 'Torino', colors: ['#8A1E03', '#FFFFFF'] },
  { id: 'udinese', name: 'Udinese', colors: ['#000000', '#FFFFFF'] },
  { id: 'verona', name: 'Verona', colors: ['#005395', '#FCE100'] },
];

export const MOCK_HISTORY = [
  { id: 1, result: 'WIN', score: '2-1', opponent: 'AI (Gemini)', date: 'Today' },
  { id: 2, result: 'LOSS', score: '1-3', opponent: 'AI (Gemini)', date: 'Yesterday' },
];
