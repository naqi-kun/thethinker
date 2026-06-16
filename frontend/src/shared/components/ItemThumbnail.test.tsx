import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ItemThumbnail from './ItemThumbnail';

const withImage = {
  image_url: 'https://example.com/shirt.png',
  sub_type: 'shirt',
  color: 'blue',
};
const noImage = { sub_type: 'sneakers', color: 'red' };

describe('ItemThumbnail', () => {
  it('renders the image when image_url is present', () => {
    render(<ItemThumbnail item={withImage} alt="Blue Shirt" />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('src')).toBe(withImage.image_url);
    expect(img.getAttribute('alt')).toBe('Blue Shirt');
  });

  it('renders the icon + colour-swatch fallback when there is no image', () => {
    render(<ItemThumbnail item={noImage} />);
    expect(screen.queryByRole('img')).toBeNull();
    // The colour swatch carries the colour name as its title.
    expect(screen.getByTitle('red')).toBeTruthy();
  });

  it('falls back to the swatch when the image fails to load', () => {
    render(<ItemThumbnail item={withImage} />);
    fireEvent.error(screen.getByRole('img'));
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByTitle('blue')).toBeTruthy();
  });

  it('keeps the box a fixed aspect with the min-h-0 guard (the bug class)', () => {
    const { container } = render(<ItemThumbnail item={withImage} />);
    const box = container.firstChild as HTMLElement;
    expect(box.className).toContain('aspect-square');
    expect(box.className).toContain('min-h-0');
  });

  it('supports a video aspect and a top inset for overlay controls', () => {
    const { container } = render(
      <ItemThumbnail item={withImage} aspect="video" topInset>
        <button type="button">overlay</button>
      </ItemThumbnail>,
    );
    const box = container.firstChild as HTMLElement;
    expect(box.className).toContain('aspect-video');
    expect(box.className).toContain('pt-12');
    // Overlay slot children render inside the box.
    expect(screen.getByRole('button', { name: 'overlay' })).toBeTruthy();
  });
});
