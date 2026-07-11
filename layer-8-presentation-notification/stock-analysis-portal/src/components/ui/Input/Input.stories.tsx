import React from 'react';
import Input from './Input';

export default {
  title: 'Atoms/Input',
  component: Input,
  tags: ['autodocs'],
  argTypes: {
    type: { control: 'select', options: ['text', 'password', 'email', 'number', 'search'] },
    placeholder: { control: 'text' },
    label: { control: 'text' },
    error: { control: 'text' },
    helperText: { control: 'text' },
    disabled: { control: 'boolean' },
    required: { control: 'boolean' },
  },
};

export const Default = { args: { placeholder: 'Enter symbol...' } };
export const WithLabel = { args: { label: 'Symbol', placeholder: 'NIFTY' } };
export const Required = { args: { label: 'API Key', required: true, placeholder: 'Enter your API key' } };
export const WithError = { args: { label: 'Price', value: '-50', error: 'Price must be positive' } };
export const WithHelper = { args: { label: 'Stop Loss %', helperText: 'Percentage of entry price', placeholder: '0.18' } };
export const Disabled = { args: { label: 'Exchange', value: 'NSE', disabled: true } };
export const Password = { args: { label: 'Password', type: 'password', placeholder: '••••••••' } };
export const Number = { args: { label: 'Quantity', type: 'number', placeholder: '0' } };

export const AllStates = {
  name: 'All states',
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '320px' }}>
      <Input label="Normal" placeholder="Type here..." />
      <Input label="With error" error="This field is required" placeholder="Empty" />
      <Input label="Disabled" disabled value="Cannot edit" />
      <Input label="With helper" helperText="Enter your broker API key" placeholder="api_key_..." />
      <Input label="Required" required placeholder="Must be filled" />
    </div>
  ),
};
