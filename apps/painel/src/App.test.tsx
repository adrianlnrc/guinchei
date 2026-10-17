import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App painel', () => {
  it('mostra o título', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Painel' })).toBeTruthy();
  });
});
