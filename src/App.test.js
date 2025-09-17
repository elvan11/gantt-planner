import { render, screen } from '@testing-library/react';
import App from './App';

test('renders planner heading and today marker toggle', () => {
  render(<App />);
  expect(screen.getByText(/Rekonnect planner/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/Show Today marker/i)).toBeInTheDocument();
});
