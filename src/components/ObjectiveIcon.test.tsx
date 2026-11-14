import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ICON_LABEL, isObjectiveIcon, ObjectiveIcon, OBJECTIVE_ICONS } from './ObjectiveIcon';

describe('icônes d’objectifs', () => {
  it.each(OBJECTIVE_ICONS)('« %s » se dessine, avec un nom accessible', (name) => {
    const { container } = render(<ObjectiveIcon icon={name} />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('data-icon', name);
    expect(svg).toHaveAttribute('aria-label', ICON_LABEL[name]);
    expect(svg.children.length).toBeGreaterThan(0);
  });

  it('sans icône, ou avec une icône inconnue, un drapeau', () => {
    const { container, rerender } = render(<ObjectiveIcon />);
    expect(container.querySelector('svg')).toHaveAttribute('data-icon', 'flag');
    rerender(<ObjectiveIcon icon="dragon" />);
    expect(container.querySelector('svg')).toHaveAttribute('data-icon', 'flag');
    expect(isObjectiveIcon('dragon')).toBe(false);
    expect(isObjectiveIcon('key')).toBe(true);
  });

  it('le titre de l’objectif sert de nom accessible', () => {
    render(<ObjectiveIcon icon="key" title="Reprendre la clé" />);
    expect(screen.getByRole('img', { name: 'Reprendre la clé' })).toBeInTheDocument();
  });

  it('taille et couleur sont réglables', () => {
    const { container } = render(<ObjectiveIcon icon="flame" size={40} color="#ff0000" />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('width', '40');
    expect(container.querySelector('path')).toHaveAttribute('fill', '#ff0000');
  });
});
