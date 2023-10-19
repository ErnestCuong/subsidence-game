import { FaTrashAlt } from "react-icons/fa";

const Trash = ({ onClick, disabled = false }) => {
  return (
    <button className="bg-red-300 w-full h-full flex justify-center items-center" onClick={onClick} disabled={disabled}>
      <FaTrashAlt/>
    </button>
  )
}

export default Trash