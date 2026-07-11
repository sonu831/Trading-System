import React from 'react';
import Table from './Table';

export default {
  title: 'Molecules/Table',
  component: Table,
  tags: ['autodocs'],
  argTypes: {
    striped: { control: 'boolean' },
    hoverable: { control: 'boolean' },
  },
};

const sampleColumns = ['Symbol', 'LTP', 'Change %', 'Volume', 'Trend'];
const sampleData = [
  ['RELIANCE', '₹2,845.60', '+1.24%', '3.2M', 'UP'],
  ['TCS', '₹3,921.15', '-0.43%', '1.8M', 'DOWN'],
  ['HDFCBANK', '₹1,634.80', '+2.10%', '5.7M', 'UP'],
  ['INFY', '₹1,512.40', '+0.89%', '2.3M', 'UP'],
  ['ICICIBANK', '₹1,089.25', '-1.15%', '4.1M', 'DOWN'],
];

export const Default = {
  render: () => (
    <Table>
      <Table.Header>
        <Table.Row>
          {sampleColumns.map((col) => (
            <Table.HeaderCell key={col}>{col}</Table.HeaderCell>
          ))}
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {sampleData.map((row, i) => (
          <Table.Row key={i}>
            {row.map((cell, j) => (
              <Table.Cell key={j}>{cell}</Table.Cell>
            ))}
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  ),
};

export const Striped = {
  render: () => (
    <Table striped>
      <Table.Header>
        <Table.Row>
          {sampleColumns.map((col) => (
            <Table.HeaderCell key={col}>{col}</Table.HeaderCell>
          ))}
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {sampleData.map((row, i) => (
          <Table.Row key={i}>
            {row.map((cell, j) => (
              <Table.Cell key={j}>{cell}</Table.Cell>
            ))}
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  ),
};

export const Hoverable = {
  render: () => (
    <Table striped hoverable>
      <Table.Header>
        <Table.Row>
          {sampleColumns.map((col) => (
            <Table.HeaderCell key={col}>{col}</Table.HeaderCell>
          ))}
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {sampleData.map((row, i) => (
          <Table.Row key={i}>
            {row.map((cell, j) => (
              <Table.Cell key={j}>{cell}</Table.Cell>
            ))}
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  ),
};

export const Empty = {
  name: 'Empty state',
  render: () => (
    <Table striped hoverable>
      <Table.Header>
        <Table.Row>
          {sampleColumns.map((col) => (
            <Table.HeaderCell key={col}>{col}</Table.HeaderCell>
          ))}
        </Table.Row>
      </Table.Header>
      <Table.Body>
        <Table.Row>
          <Table.Cell colSpan={sampleColumns.length} className="px-6 py-8 text-center">
            <span className="text-text-tertiary">No trades executed today</span>
          </Table.Cell>
        </Table.Row>
      </Table.Body>
    </Table>
  ),
};
