import React from 'react';

const LoadingState = ({ minHeight = 'min-h-64' }) => {
  return (
    <div className={`flex items-center justify-center ${minHeight}`}>
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
};

export default LoadingState;
