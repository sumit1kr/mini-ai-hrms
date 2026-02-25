import React from 'react';

const EmptyState = ({ icon = '📭', title = 'No data found', subtitle }) => {
  return (
    <div className="card text-center py-12">
      <p className="text-4xl mb-3">{icon}</p>
      <p className="text-gray-600 font-medium">{title}</p>
      {subtitle ? <p className="text-sm text-gray-500 mt-1">{subtitle}</p> : null}
    </div>
  );
};

export default EmptyState;
