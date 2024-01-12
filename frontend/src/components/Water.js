import { GiWaterDrop } from "react-icons/gi";

const Water = ({ onClick, disabled = false }) => {
  return (
    <button className={`bg-blue-300 w-full h-full flex justify-center items-center ${disabled ? 'bg-blue-500' : ''}`} onClick={onClick} disabled={disabled}>
      {disabled ? <p className="font-bold">R</p> :<GiWaterDrop/>}
    </button>
  )
}

export default Water