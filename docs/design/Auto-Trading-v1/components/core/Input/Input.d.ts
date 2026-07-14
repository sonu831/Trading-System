import { InputHTMLAttributes } from 'react';

/**
 * @startingPoint section="Components" subtitle="Labeled text field w/ error state" viewport="700x180"
 */
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export function Input(props: InputProps): JSX.Element;
