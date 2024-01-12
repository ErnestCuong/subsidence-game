import { GiFactory } from "react-icons/gi";

const Factory = ({ onClick, disabled = false }) => {
  return (
    <button className="bg-yellow-300 w-full h-full flex justify-center items-center" onClick={onClick} disabled={disabled}>
      <GiFactory/>
    </button>
  )
}

export default Factory