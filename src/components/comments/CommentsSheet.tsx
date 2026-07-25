import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import ProductComments from '@/components/products/ProductComments';

interface CommentsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  title?: string;
}

/**
 * Reusable bottom-sheet wrapper for the product comments component.
 * Used by reels and other surfaces that need a quick comment thread.
 */
const CommentsSheet = ({ open, onOpenChange, productId, title = 'Comments' }: CommentsSheetProps) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">
          <ProductComments productId={productId} />
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default CommentsSheet;
