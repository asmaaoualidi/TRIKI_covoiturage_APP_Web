import React from 'react';
import Map from './Map';

function MapPickerHome({ start, end, className = '', style }) {
  return (
    <div className={className} style={style}>
      <Map start={start} end={end} />
    </div>
  );
}

export default MapPickerHome;
