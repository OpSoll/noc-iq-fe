import { createRef, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { TextArea } from '@/components/ui/TextArea';

it('shows initial count and switches colors at exactly 90% and 100%', () => {
  const { rerender } = render(
    <TextArea value={'a'.repeat(449)} maxLength={500} readOnly />
  );
  expect(screen.getByText('449 / 500 characters')).toHaveClass(
    'text-slate-500'
  );
  rerender(<TextArea value={'a'.repeat(450)} maxLength={500} readOnly />);
  expect(screen.getByText('450 / 500 characters')).toHaveClass(
    'text-amber-600'
  );
  rerender(<TextArea value={'a'.repeat(500)} maxLength={500} readOnly />);
  expect(screen.getByText('500 / 500 characters')).toHaveClass('text-red-600');
});

it('counts uncontrolled typing and deletion and blocks overflow from typing and paste', async () => {
  const user = userEvent.setup();
  render(
    <TextArea aria-label="Description" defaultValue="abc" maxLength={10} />
  );
  const field = screen.getByRole('textbox');
  expect(screen.getByText('3 / 10 characters')).toBeInTheDocument();
  await user.type(field, 'defghijkl');
  expect(field).toHaveValue('abcdefghij');
  expect(screen.getByText('10 / 10 characters')).toHaveClass('text-red-600');
  await user.clear(field);
  await user.paste('123456789012345');
  expect(field).toHaveValue('1234567890');
  await user.keyboard('{Backspace}');
  expect(screen.getByText('9 / 10 characters')).toHaveClass('text-amber-600');
});

it('forwards bounded changes to a controlled parent and preserves accessible descriptions and refs', () => {
  const onChange = vi.fn();
  const ref = createRef<HTMLTextAreaElement>();
  function Form() {
    const [value, setValue] = useState('');
    return (
      <>
        <p id="help">Describe the outage.</p>
        <TextArea
          ref={ref}
          value={value}
          maxLength={5}
          aria-describedby="help"
          onChange={(event) => {
            onChange(event.target.value);
            setValue(event.target.value);
          }}
        />
      </>
    );
  }
  render(<Form />);
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'abcdef' },
  });
  expect(onChange).toHaveBeenCalledWith('abcde');
  expect(ref.current).toHaveValue('abcde');
  expect(ref.current).toHaveAccessibleDescription(
    'Describe the outage. 5 / 5 characters'
  );
});
