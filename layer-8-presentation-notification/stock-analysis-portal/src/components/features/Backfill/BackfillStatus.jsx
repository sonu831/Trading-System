import React from 'react';
import PropTypes from 'prop-types';
import { Badge, Table } from '@/components/ui';

export const BackfillStatus = ({ jobStatus }) => {
  if (!jobStatus) return null;

  const formatDateTime = (dateStr) => (dateStr ? new Date(dateStr).toLocaleString() : 'N/A');

  return (
    <div className="bg-white/5 p-4 rounded-lg border border-white/10 mb-4 backdrop-blur-sm">
      <h3 className="text-lg font-bold text-slate-300 mb-3">⚡ Job Status</h3>
      <Table className="w-full">
        <Table.Body className="text-sm">
          <Table.Row className="border-b border-white/5">
            <Table.Cell className="text-slate-500 w-32 py-2">Job ID:</Table.Cell>
            <Table.Cell className="font-mono text-indigo-400 py-2">{jobStatus.jobId}</Table.Cell>
          </Table.Row>
          <Table.Row className="border-b border-white/5">
            <Table.Cell className="text-slate-500 py-2">Symbols:</Table.Cell>
            <Table.Cell className="py-2 text-slate-200">{jobStatus.symbol}</Table.Cell>
          </Table.Row>
          <Table.Row className="border-b border-white/5">
            <Table.Cell className="text-slate-500 py-2">Range:</Table.Cell>
            <Table.Cell className="py-2 text-slate-200">
              {jobStatus.from} to {jobStatus.to}
            </Table.Cell>
          </Table.Row>
          <Table.Row className="border-b border-white/5">
            <Table.Cell className="text-slate-500 py-2">Status:</Table.Cell>
            <Table.Cell className="py-2">
              <Badge variant="info" size="sm" className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30">
                {jobStatus.status}
              </Badge>
            </Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.Cell className="text-slate-500 py-2">Started:</Table.Cell>
            <Table.Cell className="py-2 text-slate-300">{formatDateTime(jobStatus.timestamp)}</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table>
    </div>
  );
};

BackfillStatus.propTypes = {
  jobStatus: PropTypes.shape({
    jobId: PropTypes.string,
    symbol: PropTypes.string,
    from: PropTypes.string,
    to: PropTypes.string,
    status: PropTypes.string,
    timestamp: PropTypes.string,
  }),
};
