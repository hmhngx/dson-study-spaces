import { useState, useEffect, useRef } from "react";
import BuildingCard from './BuildingCards';

const LazyBuildingCard = ({ building, day, onClick, coordinates, id }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [hasError, setHasError] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect(); 
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  if (hasError) {
    return (
      <div className="text-red-500 p-4">
        Error rendering {building.name}
      </div>
    );
  }

  return (
    <div ref={ref} className="min-h-[100px]">
      {isVisible && (
        <BuildingCard
          building={building}
          day={day}
          coordinates={coordinates}
          onClick={onClick}
          id={id}
          onError={() => setHasError(true)}
        />
      )}
    </div>
  );
};

export default LazyBuildingCard;