import { FaRoad } from "react-icons/fa";

const Road = ({ onClick, disabled = false }) => {
  return (
    <button className="bg-gray-300 w-full h-full flex justify-center items-center" onClick={onClick} disabled={disabled}>
      <FaRoad/>
    </button>
  )
}

export default Road