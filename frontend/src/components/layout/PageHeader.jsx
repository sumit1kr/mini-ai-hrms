import React from 'react';

const PageHeader = ({ title, subtitle, actions, titleClassName = '', className = '' }) => {
  return (
    <div className={`page-header ${className}`.trim()}>
      <div className="page-header__text">
        <h1 className={`page-title ${titleClassName}`.trim()}>{title}</h1>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </div>
  );
};

export default PageHeader;
