import { FaTree } from "react-icons/fa";

const Tree = ({ onClick, disabled = false }) => {
  return (
    <button className="bg-green-300 w-full h-full flex justify-center items-center" onClick={onClick} disabled={disabled}>
      <FaTree/>
    </button>
  )
}

export default Tree