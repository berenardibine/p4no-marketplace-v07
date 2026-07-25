import { MessageSquare, Phone, CheckCircle, Clock, User, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface RequestListProps {
  requests: any[];
  loading: boolean;
  onUpdateStatus: (requestId: string, status: string) => Promise<void>;
}

const RequestList = ({ requests, loading, onUpdateStatus }: RequestListProps) => {
  const handleCall = (phone: string) => {
    window.open(`tel:${phone}`, '_self');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-RW', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-12">
        <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="font-semibold mb-2">No Requests Yet</h3>
        <p className="text-muted-foreground text-sm">
          When buyers request your products, they'll appear here
        </p>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'contacted':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'completed':
        return 'bg-green-500/10 text-green-600 border-green-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-3">
      {requests.map(request => (
        <div key={request.id} className="bg-card rounded-xl p-4 border">
          {/* Product Info */}
          {request.product && (
            <div className="flex items-center gap-3 mb-3 pb-3 border-b">
              <img 
                src={request.product.images?.[0] || '/placeholder.svg'}
                alt={request.product.title}
                className="w-12 h-12 rounded-lg object-cover"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm line-clamp-1">{request.product.title}</p>
                <p className="text-xs text-primary font-semibold">
                  {new Intl.NumberFormat('en-RW', { 
                    style: 'currency', 
                    currency: 'RWF', 
                    minimumFractionDigits: 0 
                  }).format(request.product.price)}
                </p>
              </div>
              <Badge className={getStatusColor(request.status)}>
                {request.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                {request.status === 'completed' && <CheckCircle className="h-3 w-3 mr-1" />}
                {request.status}
              </Badge>
            </div>
          )}

          {/* Buyer Info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{request.buyer_name}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-4 w-4" />
              <span>{request.buyer_phone}</span>
            </div>
            {request.buyer_location && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{request.buyer_location}</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Requested {formatDate(request.created_at)}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-4">
            <Button 
              variant="outline" 
              size="sm"
              className="flex-1 gap-2"
              onClick={() => handleCall(request.buyer_phone)}
            >
              <Phone className="h-4 w-4" />
              Call Buyer
            </Button>
            {request.status !== 'completed' && (
              <Button 
                size="sm"
                className="flex-1 gap-2 bg-green-500 hover:bg-green-600"
                onClick={() => onUpdateStatus(request.id, 'completed')}
              >
                <CheckCircle className="h-4 w-4" />
                Mark Done
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default RequestList;
