import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { DiscoveryHero } from './DiscoveryHero';

describe('DiscoveryHero', () => {
  afterEach(cleanup);

  it('exposes labeled catalog controls and announces the active category', () => {
    render(
      <DiscoveryHero
        search=""
        sortBy="date_asc"
        selectedCategory="All"
        selectedCity="All"
        onSearchChange={() => undefined}
        onSortChange={() => undefined}
        onCategoryChange={() => undefined}
        onSubmit={() => undefined}
      />,
    );

    expect(screen.getByLabelText('Tìm kiếm sự kiện')).toBeInTheDocument();
    expect(screen.getByLabelText('Sắp xếp sự kiện')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tất cả sự kiện' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Toàn quốc' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'TP. Hồ Chí Minh' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('triggers onCityChange when clicking a city pill', () => {
    const handleCityChange = vi.fn();
    render(
      <DiscoveryHero
        search=""
        sortBy="date_asc"
        selectedCategory="All"
        selectedCity="All"
        onSearchChange={() => undefined}
        onSortChange={() => undefined}
        onCategoryChange={() => undefined}
        onCityChange={handleCityChange}
        onSubmit={() => undefined}
      />,
    );

    const hanoiBtn = screen.getByRole('button', { name: 'Hà Nội' });
    fireEvent.click(hanoiBtn);
    expect(handleCityChange).toHaveBeenCalledWith('Hanoi');
  });
});
