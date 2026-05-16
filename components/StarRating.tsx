'use client';
// components/StarRating.tsx

interface StarRatingProps {
  value: number;
  onChange?: (v: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function StarRating({ value, onChange, readonly = false, size = 'md' }: StarRatingProps) {
  const sizes = { sm: 'text-base', md: 'text-xl', lg: 'text-3xl' };

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          className={`${sizes[size]} transition-transform ${!readonly ? 'hover:scale-110 cursor-pointer' : 'cursor-default'}`}
          style={{ color: star <= value ? '#f5c518' : '#333' }}
        >
          ★
        </button>
      ))}
    </div>
  );
}
